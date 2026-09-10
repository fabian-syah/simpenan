// ============================================================
// POST /api/files/star
// Toggles or sets starred status for a file/folder
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileId, isStarred } = req.body;
    if (!fileId) return res.status(400).json({ error: 'fileId is required' });

    let newStatus = isStarred;

    if (newStatus === undefined) {
      // Toggle
      const { data: current, error: fetchErr } = await supabaseAdmin
        .from('files')
        .select('is_starred')
        .eq('id', fileId)
        .single();

      if (fetchErr || !current) {
        return res.status(404).json({ error: 'File not found' });
      }
      newStatus = !current.is_starred;
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('files')
      .update({ is_starred: newStatus })
      .eq('id', fileId)
      .select('id, is_starred')
      .single();

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update star status', details: updateErr.message });
    }

    return res.status(200).json({ success: true, file: updated });
  } catch (err: any) {
    console.error('Star error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
