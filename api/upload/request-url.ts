// ============================================================
// POST /api/upload/request-url
// The critical presigned URL endpoint
// 1. Finds the provider with the most remaining free quota
// 2. Generates presigned URL(s) for direct browser upload
// 3. Registers the file in the metadata database
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, getAuthUser } from '../_lib/supabase.js';
import {
  getPresignedUploadUrl,
  initiateMultipartUpload,
  getMultipartPresignedUrls,
} from '../_lib/storage-providers.js';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50 MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      fileName,
      fileSize,
      mimeType,
      parentPath = '/',
      provider: requestedProvider,
    } = req.body;

    if (!fileName || fileSize === undefined || fileSize === null) {
      return res.status(400).json({ error: 'fileName and fileSize are required' });
    }

    // Authenticate user & verify tier quota
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({
        error: 'Silakan masuk atau daftar akun terlebih dahulu untuk mengunggah berkas.',
        code: 'AUTH_REQUIRED',
      });
    }

    let userTier = 'starter';
    let maxFileSizeBytes = 262144000; // 250 MB
    let storageLimitBytes = 2147483648; // 2 GB

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

      if (profile) {
        userTier = profile.tier || 'starter';
        maxFileSizeBytes = profile.max_file_size_bytes || (userTier === 'creator' ? 21474836480 : userTier === 'pro' || userTier === 'founder' ? 5368709120 : 262144000);
        storageLimitBytes = profile.storage_limit_bytes || (userTier === 'creator' ? 214748364800 : userTier === 'pro' || userTier === 'founder' ? 53687091200 : 2147483648);
      }
    }

    // Enforce max file size per tier
    if (fileSize > maxFileSizeBytes) {
      const maxMB = Math.round(maxFileSizeBytes / (1024 * 1024));
      const limitStr = maxMB >= 1024 ? `${(maxMB / 1024).toFixed(0)} GB` : `${maxMB} MB`;
      return res.status(403).json({
        error: 'FILE_SIZE_LIMIT_EXCEEDED',
        tier: userTier,
        maxFileSizeBytes,
        message: `Batas ukuran berkas untuk akun ${userTier.toUpperCase()} adalah ${limitStr}. Ambil penawaran terbatas: Upgrade ke 50 GB Lifetime seharga Rp 99.000 untuk batas upload 5 GB per file!`,
      });
    }

    // Check user storage limit
    if (authUser) {
      const { data: userFiles } = await supabaseAdmin
        .from('files')
        .select('size_bytes')
        .eq('user_id', authUser.id)
        .eq('upload_status', 'complete')
        .eq('is_trashed', false);

      const currentUserUsed = (userFiles || []).reduce((acc: number, f: any) => acc + (Number(f.size_bytes) || 0), 0);
      if (currentUserUsed + fileSize > storageLimitBytes) {
        return res.status(403).json({
          error: 'STORAGE_QUOTA_EXCEEDED',
          tier: userTier,
          storageLimitBytes,
          usedBytes: currentUserUsed,
          message: 'Kapasitas penyimpanan akun Anda tidak mencukupi. Silakan upgrade paket untuk menambah kuota.',
        });
      }
    }

    // 1. Query storage providers
    const { data: providers, error: provErr } = await supabaseAdmin
      .from('storage_providers')
      .select('*')
      .eq('is_active', true);

    if (provErr || !providers?.length) {
      return res.status(500).json({ error: 'No storage providers available' });
    }

    const isVideo = (mimeType && mimeType.startsWith('video/')) || /\.(mp4|mkv|mov|avi|webm|flv)$/i.test(fileName);
    const isOverFilebaseVideoLimit = isVideo && fileSize > 25 * 1024 * 1024;
    const isOverSupabaseLimit = fileSize > 50 * 1024 * 1024;

    if (requestedProvider === 'filebase' && isOverFilebaseVideoLimit) {
      return res.status(400).json({
        error: 'Filebase (Free Tier) membatasi ukuran video maksimal 25 MB. Silakan gunakan Supabase Storage (maks 50 MB) atau Backblaze B2.'
      });
    }

    if (requestedProvider === 'supabase' && isOverSupabaseLimit) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      return res.status(400).json({
        error: `Supabase Storage (Free Tier) membatasi ukuran berkas maksimal 50 MB (berkas Anda: ${sizeMB} MB). Silakan gunakan Backblaze B2 atau Auto.`
      });
    }

    // Filter providers that have enough remaining capacity for this file
    // Exclude Filebase if it is a video over 25MB (Filebase Free tier policy)
    // Exclude Supabase if file is over 50MB (Supabase Free tier platform limit)
    const eligibleProviders = providers.filter((p: any) => {
      const hasSpace = (p.max_bytes - p.used_bytes) >= fileSize;
      if (!hasSpace) return false;
      if (p.id === 'filebase' && isOverFilebaseVideoLimit) return false;
      if (p.id === 'supabase' && isOverSupabaseLimit) return false;
      return true;
    });

    if (eligibleProviders.length === 0) {
      if (isOverSupabaseLimit && isOverFilebaseVideoLimit) {
        return res.status(507).json({
          error: 'Berkas video di atas 50 MB hanya didukung oleh Backblaze B2. Saat ini kuota Backblaze belum mencukupi.'
        });
      }
      return res.status(507).json({ error: 'Kapasitas penyimpanan tidak mencukupi di seluruh provider yang kompatibel.' });
    }

    let selectedProvider: any = null;

    // Check if user specifically requested a provider
    if (requestedProvider && requestedProvider !== 'auto') {
      selectedProvider = eligibleProviders.find((p: any) => p.id === requestedProvider);
      if (!selectedProvider) {
        const exists = providers.find((p: any) => p.id === requestedProvider);
        if (exists) {
          return res.status(507).json({
            error: `Selected provider '${requestedProvider}' does not have enough free space for this file.`,
          });
        }
      }
    }

    // If auto or requested provider not found/specified:
    // User requirement: Prioritize Google Drive accounts pool (Drive 1, Drive 2, etc.)
    if (!selectedProvider) {
      const gdriveCandidates = eligibleProviders.filter((p: any) => p.id.startsWith('gdrive'));
      if (gdriveCandidates.length > 0) {
        gdriveCandidates.sort((a: any, b: any) => {
          const ratioA = a.used_bytes / (a.max_bytes || 1);
          const ratioB = b.used_bytes / (b.max_bytes || 1);
          return ratioA - ratioB;
        });
        selectedProvider = gdriveCandidates[0];
      } else {
        const candidates = [...eligibleProviders].sort((a: any, b: any) => {
          const ratioA = a.used_bytes / (a.max_bytes || 1);
          const ratioB = b.used_bytes / (b.max_bytes || 1);
          if (Math.abs(ratioA - ratioB) < 0.05) {
            return Math.random() - 0.5;
          }
          return ratioA - ratioB;
        });
        selectedProvider = candidates[0];
      }
    }

    const providerId = selectedProvider.id;

    // 2. Generate storage key
    const timestamp = Date.now();
    const cleanParent = parentPath === '/' ? '' : parentPath.replace(/^\//, '');
    const storageKey = cleanParent
      ? `${cleanParent}/${timestamp}-${fileName}`
      : `${timestamp}-${fileName}`;
    const filePath = parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`;

    // 3. Register file in metadata database
    
    // Cleanup any previous stuck upload attempts for this exact path
    let cleanupQuery = supabaseAdmin
      .from('files')
      .delete()
      .eq('path', filePath)
      .eq('upload_status', 'uploading');

    if (authUser) {
      cleanupQuery = cleanupQuery.eq('user_id', authUser.id);
    }

    await cleanupQuery;

    const { data: fileRecord, error: fileErr } = await supabaseAdmin
      .from('files')
      .insert({
        user_id: authUser?.id || null,
        name: fileName,
        path: filePath,
        parent_path: parentPath,
        size_bytes: fileSize,
        mime_type: mimeType || 'application/octet-stream',
        provider_id: providerId,
        storage_key: storageKey,
        upload_status: 'uploading',
      })
      .select()
      .single();

    if (fileErr) {
      if (fileErr.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'File already exists in this folder' });
      }
      return res.status(500).json({ error: 'Failed to register file', details: fileErr.message });
    }

    // 4. Generate presigned URLs
    const contentType = mimeType || 'application/octet-stream';

    // MEGA Storage upload session
    if (providerId === 'mega') {
      const { getMegaStorage } = await import('../_lib/mega.js');
      const storage = await getMegaStorage();
      const session = storage.toJSON();

      return res.status(200).json({
        fileId: fileRecord.id,
        provider: 'mega',
        presignedUrls: [],
        megaSession: session,
        uploadId: null,
        storageKey,
        chunkSize: fileSize,
      });
    }

    // MediaFire Storage upload session
    if (providerId === 'mediafire') {
      const { getMediaFireSessionToken } = await import('../_lib/mediafire.js');
      const token = await getMediaFireSessionToken();
      const uploadUrl = `https://www.mediafire.com/api/1.5/upload/simple.php?session_token=${token}&response_format=json`;

      return res.status(200).json({
        fileId: fileRecord.id,
        provider: 'mediafire',
        presignedUrls: [uploadUrl],
        mediafireToken: token,
        uploadId: null,
        storageKey,
        chunkSize: fileSize,
      });
    }

    // Google Drive Storage upload session (via Google Apps Script Web App Resumable Upload)
    if (providerId === 'gdrive' || providerId.startsWith('gdrive')) {
      const { createGDriveResumableUpload, GDRIVE_SCRIPT_URL, GDRIVE_SECRET } = await import('../_lib/gdrive.js');
      const origin = (req.headers.origin as string) || (req.headers.referer ? new URL(req.headers.referer).origin : 'https://simpenan-theta.vercel.app');
      const scriptUrl = selectedProvider?.endpoint_url?.trim() || GDRIVE_SCRIPT_URL;

      const resumableUploadUrl = await createGDriveResumableUpload({
        fileName,
        fileSize,
        mimeType: contentType,
        origin,
        scriptUrl,
      });

      return res.status(200).json({
        fileId: fileRecord.id,
        provider: providerId,
        presignedUrls: [resumableUploadUrl],
        gdriveScriptUrl: scriptUrl,
        gdriveSecret: GDRIVE_SECRET,
        uploadId: null,
        storageKey,
        chunkSize: fileSize,
      });
    }

    // Supabase Storage presigned PUT upload
    if (providerId === 'supabase') {
      const bucket = process.env.SUPA_BUCKET || selectedProvider.bucket_name || 'drive-clone-supa-1';
      const { data: supaData, error: supaErr } = await supabaseAdmin
        .storage
        .from(bucket)
        .createSignedUploadUrl(storageKey);

      if (supaErr || !supaData?.signedUrl) {
        throw new Error(`Failed to generate Supabase upload URL: ${supaErr?.message}`);
      }

      return res.status(200).json({
        fileId: fileRecord.id,
        provider: 'supabase',
        presignedUrls: [supaData.signedUrl],
        uploadId: null,
        storageKey,
        chunkSize: fileSize,
      });
    }

    if (fileSize > MULTIPART_THRESHOLD) {
      // Multipart upload
      const partCount = Math.ceil(fileSize / CHUNK_SIZE);
      const uploadId = await initiateMultipartUpload(providerId, storageKey, contentType);
      const presignedUrls = await getMultipartPresignedUrls(
        providerId, storageKey, uploadId, partCount
      );

      // Store upload ID for completion
      await supabaseAdmin
        .from('files')
        .update({ upload_id: uploadId, chunk_count: partCount })
        .eq('id', fileRecord.id);

      return res.status(200).json({
        fileId: fileRecord.id,
        provider: providerId,
        presignedUrls,
        uploadId,
        storageKey,
        chunkSize: CHUNK_SIZE,
      });
    } else {
      // Single-part upload
      const presignedUrl = await getPresignedUploadUrl(providerId, storageKey, contentType);

      return res.status(200).json({
        fileId: fileRecord.id,
        provider: providerId,
        presignedUrls: [presignedUrl],
        uploadId: null,
        storageKey,
        chunkSize: fileSize,
      });
    }
  } catch (err: any) {
    console.error('Upload request-url error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error', details: err.message });
  }
}
