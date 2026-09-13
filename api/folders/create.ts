// ============================================================
// POST /api/folders/create
// Creates a virtual folder entry in the metadata database
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, getAuthUser } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, parentPath = '/' } = req.body;

    if (!name) return res.status(400).json({ error: 'Folder name is required' });

    const authUser = await getAuthUser(req);
    const folderPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;

    // Check if folder already exists for this user
    let existingQuery = supabaseAdmin
      .from('files')
      .select('id')
      .eq('path', folderPath)
      .eq('is_folder', true);

    if (authUser) {
      existingQuery = existingQuery.eq('user_id', authUser.id);
    } else {
      existingQuery = existingQuery.is('user_id', null);
    }

    const { data: existing } = await existingQuery.single();

    if (existing) {
      return res.status(409).json({ error: 'Folder already exists' });
    }

    const { data: folder, error } = await supabaseAdmin
      .from('files')
      .insert({
        user_id: authUser?.id || null,
        name,
        path: folderPath,
        parent_path: parentPath,
        is_folder: true,
        size_bytes: 0,
        upload_status: 'complete',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create folder', details: error.message });
    }

    return res.status(201).json({ folder });
  } catch (err: any) {
    console.error('Create folder error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
