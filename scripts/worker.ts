// ============================================================
// Simpenan Cloud — Automated Background Video Transcoder Worker
// YouTube-style native multi-resolution video pipeline
// Monitors Supabase DB, auto-encodes 720p / 480p / 360p MP4s,
// uploads to Cloud Storage, and registers in variants table.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Robust FFmpeg binary resolution: Use ffmpeg-static if available, fallback to system 'ffmpeg'
let ffmpegPath = 'ffmpeg';
try {
  const staticPath = require('ffmpeg-static');
  if (typeof staticPath === 'string' && fs.existsSync(staticPath)) {
    ffmpegPath = staticPath;
  }
} catch {
  ffmpegPath = 'ffmpeg';
}

// ------------------------------------------------------------
// 1. Environment & Clients Setup
// ------------------------------------------------------------
// Native fallback to load .env if not preloaded by runtime
if ((!process.env.SUPA_URL || !process.env.SUPA_KEY) && fs.existsSync('.env')) {
  try {
    const envText = fs.readFileSync('.env', 'utf-8');
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  } catch (envErr) {
    console.warn('[Worker] Notice loading .env fallback:', envErr);
  }
}

const SUPA_URL = process.env.SUPA_URL?.trim() || '';
const SUPA_KEY = process.env.SUPA_KEY?.trim() || '';
const SUPA_BUCKET = process.env.SUPA_BUCKET?.trim() || 'drive-clone-supa-1';

if (!SUPA_URL || !SUPA_KEY) {
  console.error('[Worker] Fatal Error: SUPA_URL and SUPA_KEY are required in .env');
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: false },
});

// S3 Clients
const s3Clients: Record<string, { client: S3Client; bucket: string }> = {};

if (process.env.B2_KEY_ID && process.env.B2_APP_KEY) {
  s3Clients['backblaze'] = {
    client: new S3Client({
      endpoint: process.env.B2_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com',
      region: process.env.B2_REGION || 'us-west-004',
      credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY,
      },
      forcePathStyle: true,
    }),
    bucket: process.env.B2_BUCKET || 'drive-clone-b2',
  };
}

if (process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET) {
  s3Clients['filebase'] = {
    client: new S3Client({
      endpoint: process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.io',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.FILEBASE_KEY,
        secretAccessKey: process.env.FILEBASE_SECRET,
      },
      forcePathStyle: true,
    }),
    bucket: process.env.FILEBASE_BUCKET || 'drive-clone-filebase-1',
  };
}

// Temp working directory
const TEMP_DIR = path.resolve(process.cwd(), 'temp_worker');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ------------------------------------------------------------
// 2. Types & Resolution Preset Config
// ------------------------------------------------------------
type Resolution = '720p' | '480p' | '360p';

interface ResolutionConfig {
  label: Resolution;
  maxHeight: number;
  crf: number;
  audioBitrate: string;
}

const RESOLUTION_PRESETS: ResolutionConfig[] = [
  { label: '720p', maxHeight: 720, crf: 23, audioBitrate: '128k' },
  { label: '480p', maxHeight: 480, crf: 24, audioBitrate: '96k' },
  { label: '360p', maxHeight: 360, crf: 26, audioBitrate: '64k' },
];

function isVideoFile(file: { name: string; mime_type: string | null }): boolean {
  if (file.mime_type && file.mime_type.toLowerCase().startsWith('video/')) return true;
  const ext = path.extname(file.name).toLowerCase();
  return ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.ts'].includes(ext);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ------------------------------------------------------------
// 3. Storage Helpers: Download & Upload
// ------------------------------------------------------------

async function downloadOriginalFile(file: any, destPath: string): Promise<void> {
  console.log(`[Download] Starting download of "${file.name}" (${formatBytes(file.size_bytes)}) from provider: ${file.provider_id}`);

  if (file.provider_id === 'mega') {
    const { getMegaDownloadStream } = await import('../api/_lib/mega.js');
    const { stream } = await getMegaDownloadStream(file.storage_key);
    const fileStream = fs.createWriteStream(destPath);
    await pipeline(stream, fileStream);
  } else if (file.provider_id === 'mediafire') {
    const { getMediaFireDownloadUrl } = await import('../api/_lib/mediafire.js');
    const directUrl = await getMediaFireDownloadUrl(file.storage_key);
    const res = await fetch(directUrl);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download from MediaFire: HTTP ${res.status}`);
    }
    const fileStream = fs.createWriteStream(destPath);
    await pipeline(Readable.fromWeb(res.body as any), fileStream);
  } else if (file.provider_id === 'supabase') {
    const { data: signedData, error: signErr } = await supabase
      .storage
      .from(SUPA_BUCKET)
      .createSignedUrl(file.storage_key, 3600);

    if (signErr || !signedData?.signedUrl) {
      throw new Error(`Failed to create Supabase download signed URL: ${signErr?.message}`);
    }

    const res = await fetch(signedData.signedUrl);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download from Supabase: HTTP ${res.status}`);
    }

    const fileStream = fs.createWriteStream(destPath);
    await pipeline(Readable.fromWeb(res.body as any), fileStream);
  } else {
    // S3 provider (Backblaze or Filebase)
    const provider = s3Clients[file.provider_id];
    if (!provider) {
      throw new Error(`Unknown or unconfigured S3 provider: ${file.provider_id}`);
    }

    const command = new GetObjectCommand({
      Bucket: provider.bucket,
      Key: file.storage_key,
    });

    const response = await provider.client.send(command);
    if (!response.Body) {
      throw new Error(`Empty response body from ${file.provider_id}`);
    }

    const fileStream = fs.createWriteStream(destPath);
    await pipeline(response.Body as Readable, fileStream);
  }

  const stat = fs.statSync(destPath);
  console.log(`[Download] Successfully downloaded to "${destPath}" (${formatBytes(stat.size)})`);
}

async function uploadVariantFile(
  fileId: string,
  resolution: Resolution,
  variantFilePath: string,
  preferredProviderId: string
): Promise<{ providerId: string; storageKey: string; sizeBytes: number }> {
  const stat = fs.statSync(variantFilePath);
  const sizeBytes = stat.size;
  const fileName = `${resolution}.mp4`;
  const storageKey = `variants/${fileId}/${resolution}.mp4`;

  console.log(`[Upload] Uploading ${resolution} variant (${formatBytes(sizeBytes)})...`);

  // Choose appropriate provider:
  // For transcoded variants, prioritize Filebase (unmetered download bandwidth) over Backblaze (which has daily bandwidth caps)
  let targetProvider = 'filebase';
  if (!s3Clients['filebase']) {
    targetProvider = s3Clients['backblaze'] ? 'backblaze' : 'supabase';
  }

  if (targetProvider === 'mega') {
    const { uploadToMega } = await import('../api/_lib/mega.js');
    const fileStream = fs.createReadStream(variantFilePath);
    const uploadRes = await uploadToMega(fileName, sizeBytes, fileStream);
    console.log(`[Upload] Finished uploading ${resolution} to MEGA (${uploadRes.link})`);
    return { providerId: 'mega', storageKey: uploadRes.link, sizeBytes };
  } else if (targetProvider === 'supabase') {
    const fileBuffer = fs.readFileSync(variantFilePath);
    const { error: uploadErr } = await supabase.storage
      .from(SUPA_BUCKET)
      .upload(storageKey, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Failed to upload variant to Supabase Storage: ${uploadErr.message}`);
    }
  } else {
    const provider = s3Clients[targetProvider];
    if (!provider) {
      // Fallback to Supabase
      console.log(`[Upload] Provider ${targetProvider} unavailable, falling back to Supabase`);
      return uploadVariantFile(fileId, resolution, variantFilePath, 'supabase');
    }

    const fileStream = fs.createReadStream(variantFilePath);
    await provider.client.send(new PutObjectCommand({
      Bucket: provider.bucket,
      Key: storageKey,
      ContentType: 'video/mp4',
      ContentLength: sizeBytes,
      Body: fileStream,
    }));
  }

  console.log(`[Upload] Finished uploading ${resolution} to ${targetProvider} (${storageKey})`);
  return { providerId: targetProvider, storageKey, sizeBytes };
}

// ------------------------------------------------------------
// 4. Native FFmpeg Transcoding Pipeline
// ------------------------------------------------------------

function runFFmpegTranscode(
  inputPath: string,
  outputPath: string,
  preset: ResolutionConfig,
  fileName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg] Starting encoding -> ${preset.label} (Max height: ${preset.maxHeight}p, CRF: ${preset.crf})`);

    // High compatibility arguments:
    // 1. -threads 0: use all native CPU cores for maximum speed
    // 2. -vf "scale=-2:min(ih\,MAX_HEIGHT)": maintain aspect ratio, prevent upscaling
    // 3. -c:v libx264 -preset veryfast -pix_fmt yuv420p: universal 8-bit MP4 compatibility (fixes 10-bit video MKV playback)
    // 4. -sn: strip incompatible ASS/SSA subtitles
    // 5. -c:a aac: universal AAC audio
    // 6. -movflags +faststart: enables instant web playback while streaming
    const args = [
      '-y',
      '-threads', '0',
      '-i', inputPath,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-vf', `scale=-2:min(ih\\,${preset.maxHeight})`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', String(preset.crf),
      '-pix_fmt', 'yuv420p',
      '-sn',
      '-c:a', 'aac',
      '-b:a', preset.audioBitrate,
      '-movflags', '+faststart',
      outputPath,
    ];

    const child = spawn(ffmpegPath!, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let lastProgressLog = 0;
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      // Parse progress: time=00:01:23.45 bitrate=... speed=2.5x
      const timeMatch = text.match(/time=(\d{2}:\d{2}:\d{2}\.\d+)/);
      const speedMatch = text.match(/speed=\s*([\d.]+x)/);
      const now = Date.now();

      if (timeMatch && (now - lastProgressLog > 4000)) {
        lastProgressLog = now;
        const timeStr = timeMatch[1];
        const speedStr = speedMatch ? speedMatch[1] : '1x';
        console.log(`[FFmpeg] [${fileName}] [${preset.label}] Encoding at ${timeStr} (Speed: ${speedStr})`);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with error code ${code}`));
      }
    });
  });
}

// ------------------------------------------------------------
// 5. Video Processing Coordinator
// ------------------------------------------------------------

const currentlyProcessing = new Set<string>();
const failedJobs = new Map<string, { attempts: number; lastAttempt: number; reason: string }>();

async function processVideo(file: any): Promise<void> {
  if (currentlyProcessing.has(file.id)) return;
  currentlyProcessing.add(file.id);

  const startTime = Date.now();
  console.log(`\n============================================================`);
  console.log(`[Job Started] Video: "${file.name}" (ID: ${file.id})`);
  console.log(`[Job Started] Size: ${formatBytes(file.size_bytes)}, Provider: ${file.provider_id}`);
  console.log(`============================================================`);

  const ext = path.extname(file.name) || '.mp4';
  const localInputPath = path.join(TEMP_DIR, `${file.id}_orig${ext}`);
  const createdVariantPaths: string[] = [];

  try {
    // 1. Check existing variants in DB
    const parentPath = `.variants/${file.id}`;
    const { data: existingVariants } = await supabase
      .from('files')
      .select('name, size_bytes, provider_id')
      .eq('parent_path', parentPath)
      .eq('upload_status', 'complete')
      .gt('size_bytes', 100);

    // Filter out variants on Backblaze since B2 bandwidth cap prevents playback
    const validVariants = (existingVariants || []).filter((v: any) => v.provider_id !== 'backblaze');
    const existingNames = new Set(validVariants.map((v: any) => v.name.toLowerCase()));

    // Filter presets that still need to be generated
    const neededPresets = RESOLUTION_PRESETS.filter((p) => {
      return !existingNames.has(`${p.label}.mp4`.toLowerCase()) &&
             !existingNames.has(`${p.label}`.toLowerCase());
    });

    const hasThumb = existingNames.has('thumb.jpg');

    if (neededPresets.length === 0 && hasThumb) {
      console.log(`[Worker] All resolution variants and thumbnail already exist for "${file.name}". Skipping.`);
      return;
    }

    if (neededPresets.length === 0 && !hasThumb) {
      console.log(`[Worker] Variants already exist for "${file.name}", generating missing thumbnail poster...`);
      // Find an existing variant to quickly download tiny file instead of full original
      const { data: existingVariantRows } = await supabase
        .from('files')
        .select('*')
        .eq('parent_path', parentPath)
        .eq('upload_status', 'complete')
        .gt('size_bytes', 100);

      const smallVariant = (existingVariantRows || []).find((v: any) => v.name.includes('360p')) || (existingVariantRows || [])[0];
      if (smallVariant) {
        await downloadOriginalFile(smallVariant, localInputPath);
      } else {
        await downloadOriginalFile(file, localInputPath);
      }
    } else {
      console.log(`[Worker] Missing variants to create: ${neededPresets.map((p) => p.label).join(', ')}`);
      // 2. Download original file
      if (fs.existsSync(localInputPath) && fs.statSync(localInputPath).size >= 1000000) {
        console.log(`[Worker] Local copy of "${file.name}" already downloaded (${formatBytes(fs.statSync(localInputPath).size)}). Reusing.`);
      } else {
        await downloadOriginalFile(file, localInputPath);
      }
    }

    // 2b. Generate video thumbnail (poster image)
    const localThumbPath = path.join(TEMP_DIR, `${file.id}_thumb.jpg`);
    try {
      console.log(`[FFmpeg] Generating thumbnail poster for "${file.name}"...`);
      const extractFrame = (seekSecs: string): Promise<boolean> => {
        return new Promise((resolve) => {
          const p = spawn(ffmpegPath!, [
            '-y',
            '-ss', seekSecs,
            '-i', localInputPath,
            '-vframes', '1',
            '-vf', 'scale=640:-2',
            '-q:v', '2',
            localThumbPath,
          ]);
          p.on('close', (code) => {
            resolve(code === 0 && fs.existsSync(localThumbPath));
          });
          p.on('error', () => resolve(false));
        });
      };

      // Try at 1s, then fallback to first frame (0s) for very short clips
      let ok = await extractFrame('00:00:01');
      if (!ok) {
        ok = await extractFrame('00:00:00');
      }

      if (fs.existsSync(localThumbPath)) {
        const thumbStat = fs.statSync(localThumbPath);
        const thumbKey = `variants/${file.id}/thumb.jpg`;
        const fileBuffer = fs.readFileSync(localThumbPath);
        await supabase.storage.from(SUPA_BUCKET).upload(thumbKey, fileBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

        await supabase.from('files').delete().eq('parent_path', parentPath).eq('name', 'thumb.jpg');
        await supabase.from('files').insert({
          name: 'thumb.jpg',
          path: `/.variants/${file.id}/thumb.jpg`,
          parent_path: parentPath,
          size_bytes: thumbStat.size,
          mime_type: 'image/jpeg',
          provider_id: 'supabase',
          storage_key: thumbKey,
          upload_status: 'complete',
          is_folder: false,
          is_starred: false,
          is_trashed: false,
        });
        console.log(`[Thumbnail] Poster created & registered (${formatBytes(thumbStat.size)})`);
        try { fs.unlinkSync(localThumbPath); } catch {}
      }
    } catch (thumbErr: any) {
      console.warn(`[Thumbnail] Notice:`, thumbErr.message);
    }

    // 3. Process each needed resolution
    for (const preset of neededPresets) {
      const variantFileName = `${preset.label}.mp4`;
      const localOutputPath = path.join(TEMP_DIR, `${file.id}_${preset.label}.mp4`);
      createdVariantPaths.push(localOutputPath);

      if (fs.existsSync(localOutputPath) && fs.statSync(localOutputPath).size > 1000000) {
        console.log(`[FFmpeg] Variant ${preset.label} already encoded on disk (${formatBytes(fs.statSync(localOutputPath).size)}). Reusing.`);
      } else {
        const encodeStart = Date.now();
        await runFFmpegTranscode(localInputPath, localOutputPath, preset, file.name);
        const encodeSecs = Math.round((Date.now() - encodeStart) / 1000);
        console.log(`[FFmpeg] Finished encoding ${preset.label} in ${encodeSecs}s!`);
      }

      // 4. Upload to Cloud Storage
      const uploadResult = await uploadVariantFile(
        file.id,
        preset.label,
        localOutputPath,
        file.provider_id
      );

      // 5. Clean up any dummy/placeholder rows in DB
      await supabase
        .from('files')
        .delete()
        .eq('parent_path', parentPath)
        .eq('name', variantFileName);

      // 6. Register variant in database
      const variantVirtualPath = `/.variants/${file.id}/${variantFileName}`;
      const { error: insertErr } = await supabase.from('files').insert({
        name: variantFileName,
        path: variantVirtualPath,
        parent_path: parentPath,
        size_bytes: uploadResult.sizeBytes,
        mime_type: 'video/mp4',
        provider_id: uploadResult.providerId,
        storage_key: uploadResult.storageKey,
        upload_status: 'complete',
        is_folder: false,
        is_starred: false,
        is_trashed: false,
      });

      if (insertErr) {
        console.error(`[DB Error] Failed to insert variant ${preset.label} into files table:`, insertErr.message);
      } else {
        console.log(`[DB Success] Registered ${preset.label} (${formatBytes(uploadResult.sizeBytes)}) in DB`);
      }
    }

    // 7. Update provider quota in DB
    try {
      const { data: sumFiles } = await supabase
        .from('files')
        .select('size_bytes')
        .eq('provider_id', file.provider_id)
        .eq('upload_status', 'complete')
        .eq('is_trashed', false);

      const totalUsed = (sumFiles || []).reduce((acc: number, f: any) => acc + (Number(f.size_bytes) || 0), 0);
      await supabase
        .from('storage_providers')
        .update({ used_bytes: totalUsed })
        .eq('id', file.provider_id);
    } catch (quotaErr) {
      console.warn('[Quota] Warning updating used_bytes:', quotaErr);
    }

    failedJobs.delete(file.id);

    const totalSecs = Math.round((Date.now() - startTime) / 1000);
    console.log(`============================================================`);
    console.log(`[Job Completed] "${file.name}" processed successfully in ${totalSecs}s!`);
    console.log(`============================================================\n`);
  } catch (err: any) {
    const prev = failedJobs.get(file.id) || { attempts: 0, lastAttempt: 0, reason: '' };
    failedJobs.set(file.id, {
      attempts: prev.attempts + 1,
      lastAttempt: Date.now(),
      reason: err.message || String(err),
    });
    console.error(`[Job Error] Failed to process video "${file.name}" (attempt ${prev.attempts + 1}):`, err.message || err);
  } finally {
    // Clean up temporary local files
    if (fs.existsSync(localInputPath)) {
      try { fs.unlinkSync(localInputPath); } catch {}
    }
    for (const p of createdVariantPaths) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }
    currentlyProcessing.delete(file.id);
  }
}

// ------------------------------------------------------------
// 6. Polling & Realtime Monitor Loop
// ------------------------------------------------------------

async function scanAndProcessPendingVideos(): Promise<void> {
  try {
    // Find all completed video files not in .variants
    const { data: files, error } = await supabase
      .from('files')
      .select('*')
      .eq('upload_status', 'complete')
      .eq('is_folder', false)
      .eq('is_trashed', false)
      .not('parent_path', 'like', '.variants%')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Scanner] DB Query error:', error.message);
      return;
    }

    const videoFiles = (files || []).filter(isVideoFile);

    for (const video of videoFiles) {
      // Check cooldown if it recently failed
      const failInfo = failedJobs.get(video.id);
      if (failInfo) {
        const isCapError = failInfo.reason.toLowerCase().includes('cap exceeded') || failInfo.reason.toLowerCase().includes('bandwidth');
        const cooldown = isCapError ? 60 * 60 * 1000 : 10 * 60 * 1000;
        if (failInfo.attempts >= 2 && Date.now() - failInfo.lastAttempt < cooldown) {
          continue;
        }
        if (failInfo.attempts >= 5) {
          continue;
        }
      }

      // Check if video needs any variants
      const parentPath = `.variants/${video.id}`;
      const { data: variants } = await supabase
        .from('files')
        .select('name, provider_id')
        .eq('parent_path', parentPath)
        .eq('upload_status', 'complete')
        .gt('size_bytes', 100);

      const validVariants = (variants || []).filter((v: any) => v.provider_id !== 'backblaze');
      const existingNames = new Set(validVariants.map((v: any) => v.name.toLowerCase()));
      const hasAllPresets = RESOLUTION_PRESETS.every((p) => {
        return existingNames.has(`${p.label}.mp4`.toLowerCase()) || existingNames.has(`${p.label}`.toLowerCase());
      });
      const hasThumb = (variants || []).some((v: any) => v.name.toLowerCase() === 'thumb.jpg');

      if ((!hasAllPresets || !hasThumb) && !currentlyProcessing.has(video.id)) {
        await processVideo(video);
      }
    }
  } catch (err: any) {
    console.error('[Scanner] Exception in scan loop:', err.message);
  }
}

async function startWorker(): Promise<void> {
  console.log(`============================================================`);
  console.log(`  Simpenan Background Video Transcoder Worker Started      `);
  console.log(`  FFmpeg Native Binary: ${ffmpegPath}`);
  console.log(`  Target Resolutions: 720p, 480p, 360p (Universal MP4)    `);
  console.log(`  Monitoring Supabase Database & Realtime Channels...      `);
  console.log(`============================================================\n`);

  const specificFileId = process.argv.find((a) => a.startsWith('--file-id='))?.split('=')[1];
  if (specificFileId) {
    console.log(`[Worker] Targeted mode: Processing file ID ${specificFileId}...`);
    const { data: targetFile, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', specificFileId)
      .single();
    if (error || !targetFile) {
      console.error('[Worker] Target file not found:', error?.message);
      process.exit(1);
    }
    await processVideo(targetFile);
    console.log('[Worker] Targeted file processed. Exiting.');
    process.exit(0);
  }

  // If running in single-scan batch mode (e.g. GitHub Actions runner or Cloud Cron)
  if (process.argv.includes('--once')) {
    console.log('[Worker] Single-scan mode (--once) active. Processing pending videos and exiting...');
    await scanAndProcessPendingVideos();
    console.log('[Worker] Batch run complete. Exiting.');
    process.exit(0);
  }

  // Start HTTP healthcheck server (allows running as Render Web Service on Free Tier)
  const PORT = process.env.PORT || 3000;
  const healthServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        service: 'simpenan-cloud-worker',
        uptime: Math.round(process.uptime()),
        activeJobs: currentlyProcessing.size,
        timestamp: new Date().toISOString(),
      })
    );
  });
  healthServer.listen(PORT, () => {
    console.log(`[Worker] Healthcheck server listening on port ${PORT} (Render Web Service ready)`);
  });

  // Run initial scan immediately
  await scanAndProcessPendingVideos();

  // Listen to Supabase Realtime channel for newly inserted/updated files
  try {
    const channel = supabase
      .channel('worker-file-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'files' },
        async (payload: any) => {
          const newRecord = payload.new;
          if (
            newRecord &&
            newRecord.upload_status === 'complete' &&
            !newRecord.is_folder &&
            !newRecord.is_trashed &&
            !newRecord.parent_path?.startsWith('.variants') &&
            isVideoFile(newRecord)
          ) {
            console.log(`[Realtime] Detected video upload complete: "${newRecord.name}"`);
            await processVideo(newRecord);
          }
        }
      )
      .subscribe();

    console.log('[Worker] Realtime channel connected.');
  } catch (rtErr: any) {
    console.warn('[Worker] Realtime connection notice:', rtErr.message);
  }

  // Periodic polling interval (every 15 seconds) as reliable fallback
  setInterval(async () => {
    await scanAndProcessPendingVideos();
  }, 15000);
}

// Handle graceful exit
process.on('SIGINT', () => {
  console.log('\n[Worker] Stopping worker gracefully...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('\n[Worker] Terminating worker...');
  process.exit(0);
});

startWorker().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
