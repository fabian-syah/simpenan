import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const fileId = req.query.id as string;
    if (!fileId) return res.status(400).json({ error: 'File ID is required' });

    // If variants_only requested (/api/files/variants rewrite)
    if (req.query.variants_only === 'true') {
      const { data: vList, error: vErr } = await supabaseAdmin
        .from('files')
        .select('id, name, size_bytes, provider_id')
        .eq('parent_path', `.variants/${fileId}`)
        .eq('upload_status', 'complete')
        .gt('size_bytes', 100);

      if (vErr) {
        console.error('Fetch variants error:', vErr);
        return res.status(500).json({ error: 'Failed to fetch variants' });
      }
      return res.status(200).json(vList || []);
    }

    // Fetch file record
    const { data: file, error } = await supabaseAdmin
      .from('files')
      .select('id, name, size_bytes, mime_type, is_folder, provider_id, created_at')
      .eq('id', fileId)
      .eq('upload_status', 'complete')
      .single();

    if (error || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // If it's a video, also fetch variants
    let variants: any[] = [];
    const isVideo = file.mime_type?.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(file.name);
    if (isVideo) {
      const { data: vList } = await supabaseAdmin
        .from('files')
        .select('id, name, size_bytes, provider_id')
        .eq('parent_path', `.variants/${fileId}`)
        .eq('upload_status', 'complete')
        .gt('size_bytes', 100);
      variants = vList || [];
    }

    return res.status(200).json({ file, variants });
  } catch (err: any) {
    console.error('Get file error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
