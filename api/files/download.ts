// ============================================================
// GET /api/files/download?id=<uuid>
// Generates a temporary presigned download URL and redirects
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';
import { getPresignedDownloadUrl } from '../_lib/storage-providers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const fileId = req.query.id as string;
    if (!fileId) return res.status(400).json({ error: 'File ID is required' });

    // Handle thumbnail request (?thumb=true)
    if (req.query.thumb === 'true') {
      const parentPath = `.variants/${fileId}`;
      const { data: thumb, error: thumbErr } = await supabaseAdmin
        .from('files')
        .select('*')
        .eq('parent_path', parentPath)
        .eq('name', 'thumb.jpg')
        .eq('upload_status', 'complete')
        .single();

      if (thumbErr || !thumb) {
        const svgPoster = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="50%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)" />
  <circle cx="320" cy="180" r="40" fill="rgba(2,132,199,0.3)" />
  <circle cx="320" cy="180" r="30" fill="rgba(15,23,42,0.85)" stroke="rgba(56,189,248,0.6)" stroke-width="2" />
  <polygon points="315,168 333,180 315,192" fill="#38bdf8" />
  <text x="320" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#94a3b8" text-anchor="middle" letter-spacing="1">VIDEO PREVIEW</text>
</svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
        return res.status(200).send(svgPoster);
      }

      if (thumb.provider_id === 'supabase') {
        const bucket = process.env.SUPA_BUCKET || 'drive-clone-supa-1';
        const { data: signedData, error: signErr } = await supabaseAdmin
          .storage
          .from(bucket)
          .createSignedUrl(thumb.storage_key || '', 86400);

        if (signErr || !signedData?.signedUrl) {
          return res.status(404).json({ error: 'Thumbnail sign error' });
        }

        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.redirect(302, signedData.signedUrl);
      }

      if (thumb.provider_id === 'mega') {
        const { getMegaDownloadStream } = await import('../_lib/mega.js');
        const { stream } = await getMegaDownloadStream(thumb.storage_key);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return stream.pipe(res);
      }

      if (thumb.provider_id === 'mediafire') {
        const { getMediaFireDownloadUrl } = await import('../_lib/mediafire.js');
        const directUrl = await getMediaFireDownloadUrl(thumb.storage_key);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.redirect(302, directUrl);
      }

      const downloadUrl = await getPresignedDownloadUrl(thumb.provider_id, thumb.storage_key, 86400);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.redirect(302, downloadUrl);
    }

    // Fetch file record
    const { data: file, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('upload_status', 'complete')
      .single();

    if (error || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.is_folder) {
      return res.status(400).json({ error: 'Cannot download a folder' });
    }

    // For MEGA provider: decrypt stream with HTTP 206 Range support
    if (file.provider_id === 'mega') {
      const { getMegaDownloadStream } = await import('../_lib/mega.js');
      const rangeHeader = req.headers.range;
      const fileSize = file.size_bytes || 0;

      if (rangeHeader && fileSize > 0) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkLength = end - start + 1;

        const { stream } = await getMegaDownloadStream(file.storage_key, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkLength,
          'Content-Type': file.mime_type || 'video/mp4',
          'Cache-Control': 'public, max-age=3600',
        });

        return stream.pipe(res);
      }

      const { stream, size } = await getMegaDownloadStream(file.storage_key);
      res.writeHead(200, {
        'Content-Length': size || fileSize,
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });

      return stream.pipe(res);
    }

    // For MediaFire provider: redirect to direct download URL (supports HTTP 206 Range seeking)
    if (file.provider_id === 'mediafire') {
      const { getMediaFireDownloadUrl } = await import('../_lib/mediafire.js');
      const directUrl = await getMediaFireDownloadUrl(file.storage_key);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.redirect(302, directUrl);
    }

    // For Supabase Storage, use Supabase signed URL
    if (file.provider_id === 'supabase') {
      const bucket = process.env.SUPA_BUCKET || 'drive-clone-supa-1';
      const { data: signedData, error: signErr } = await supabaseAdmin
        .storage
        .from(bucket)
        .createSignedUrl(file.storage_key || '', 3600);

      if (signErr || !signedData?.signedUrl) {
        console.error('Supabase download error:', signErr);
        return res.status(500).json({ error: 'Failed to generate download URL', details: signErr?.message });
      }
      return res.redirect(302, signedData.signedUrl);
    }

    // For S3-compatible providers
    const downloadUrl = await getPresignedDownloadUrl(
      file.provider_id,
      file.storage_key
    );

    return res.redirect(302, downloadUrl);
  } catch (err: any) {
    console.error('Download error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
