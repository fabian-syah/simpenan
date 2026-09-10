import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileId, newName } = req.body;
    if (!fileId || !newName) {
      return res.status(400).json({ error: 'fileId and newName are required' });
    }

    // Get current file to check parent path
    const { data: file, error: fetchErr } = await supabaseAdmin
      .from('files')
      .select('parent_path')
      .eq('id', fileId)
      .single();

    if (fetchErr || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const newPath = file.parent_path === '/' 
      ? `/${newName}` 
      : `${file.parent_path}/${newName}`;

    // Update name and path
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('files')
      .update({ name: newName, path: newPath })
      .eq('id', fileId)
      .select()
      .single();

    if (updateErr) {
      if (updateErr.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'A file with this name already exists in the current folder' });
      }
      return res.status(500).json({ error: 'Failed to rename file', details: updateErr.message });
    }

    return res.status(200).json({ success: true, file: updated });
  } catch (err: any) {
    console.error('Rename error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
