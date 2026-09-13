// ============================================================
// GET /api/files/list
// Supports:
// 1. /api/files/list?path=/ (folder listing)
// 2. /api/files/list?id=xxx&variants_only=true (variants listing)
// 3. /api/files/list?id=xxx (single file metadata + variants)
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, getAuthUser } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const fileId = req.query.id as string;

    // Handle single file or variants request
    if (fileId) {
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

      // Fetch single file record
      const { data: file, error } = await supabaseAdmin
        .from('files')
        .select('id, name, size_bytes, mime_type, is_folder, provider_id, created_at')
        .eq('id', fileId)
        .eq('upload_status', 'complete')
        .single();

      if (error || !file) {
        return res.status(404).json({ error: 'File not found' });
      }

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
    }

    // Normal folder listing
    const path = (req.query.path as string) || '/';
    const showTrashed = req.query.trashed === 'true';
    const starredOnly = req.query.starred === 'true';
    const recentOnly = req.query.recent === 'true';

    const authUser = await getAuthUser(req);

    if (!authUser) {
      // Guests / unauthenticated users must see an empty drive
      return res.status(200).json({ files: [] });
    }

    const isSuperAdmin = Boolean(
      authUser.email && (
        authUser.email.toLowerCase().includes('fabian') ||
        authUser.email.toLowerCase().includes('bian') ||
        ['fabiansyahalghiffarireal@gmail.com', 'khusussharebian@gmail.com'].includes(authUser.email.toLowerCase())
      )
    );

    // If super admin, claim any unassigned legacy files so only super admin owns them
    if (isSuperAdmin) {
      try {
        await supabaseAdmin
          .from('files')
          .update({ user_id: authUser.id })
          .is('user_id', null);
      } catch (claimErr) {
        console.warn('Auto-claim legacy files warning:', claimErr);
      }
    }

    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('upload_status', 'complete')
      .eq('user_id', authUser.id);

    if (showTrashed) {
      query = query.eq('is_trashed', true).order('updated_at', { ascending: false });
    } else if (starredOnly) {
      query = query
        .eq('is_trashed', false)
        .eq('is_starred', true)
        .order('is_folder', { ascending: false })
        .order('name', { ascending: true });
    } else if (recentOnly) {
      query = query
        .eq('is_trashed', false)
        .order('updated_at', { ascending: false })
        .limit(60);
    } else {
      query = query
        .eq('parent_path', path)
        .eq('is_trashed', false)
        .order('is_folder', { ascending: false })
        .order('name', { ascending: true });
    }

    const { data: files, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to list files', details: error.message });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({ files: files || [] });
  } catch (err: any) {
    console.error('List files error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
