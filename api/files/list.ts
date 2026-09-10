// ============================================================
// GET /api/files/list?path=/
// Returns files and folders at a given virtual path or section
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const path = (req.query.path as string) || '/';
    const showTrashed = req.query.trashed === 'true';
    const starredOnly = req.query.starred === 'true';
    const recentOnly = req.query.recent === 'true';

    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('upload_status', 'complete');

    if (showTrashed) {
      // Trashed files across all folders
      query = query.eq('is_trashed', true).order('updated_at', { ascending: false });
    } else if (starredOnly) {
      // Starred files across all folders
      query = query
        .eq('is_trashed', false)
        .eq('is_starred', true)
        .order('is_folder', { ascending: false })
        .order('name', { ascending: true });
    } else if (recentOnly) {
      // Recent files across all folders
      query = query
        .eq('is_trashed', false)
        .order('updated_at', { ascending: false })
        .limit(60);
    } else {
      // Normal folder listing
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

    // Disable caching so list queries are always 100% real-time and fresh from database
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({ files: files || [] });
  } catch (err: any) {
    console.error('List files error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
