// ============================================================
// POST /api/files/move
// Moves files or folders to a new target directory
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileIds, targetPath } = req.body;

    if (!Array.isArray(fileIds) || fileIds.length === 0 || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'fileIds (array) and targetPath are required' });
    }

    const cleanTargetPath = targetPath === '/' ? '/' : targetPath.replace(/\/+$/, '');
    const results: any[] = [];

    for (const id of fileIds) {
      const { data: file, error: fetchErr } = await supabaseAdmin
        .from('files')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !file) continue;

      const oldPath = file.path;
      const newPath = cleanTargetPath === '/' ? `/${file.name}` : `${cleanTargetPath}/${file.name}`;

      // Prevent moving a folder into itself
      if (file.is_folder && (cleanTargetPath === oldPath || cleanTargetPath.startsWith(oldPath + '/'))) {
        continue;
      }

      // Update the file itself
      const { error: updateErr } = await supabaseAdmin
        .from('files')
        .update({
          parent_path: cleanTargetPath,
          path: newPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (!updateErr) {
        // If it was a folder, cascade update children paths
        if (file.is_folder) {
          const { data: children } = await supabaseAdmin
            .from('files')
            .select('id, path, parent_path')
            .like('path', `${oldPath}/%`);

          if (children && children.length > 0) {
            for (const child of children) {
              const updatedChildPath = child.path.replace(oldPath, newPath);
              const updatedChildParent = child.parent_path.replace(oldPath, newPath);
              await supabaseAdmin
                .from('files')
                .update({
                  path: updatedChildPath,
                  parent_path: updatedChildParent,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', child.id);
            }
          }
        }
        results.push({ id, success: true });
      }
    }

    return res.status(200).json({ success: true, moved: results });
  } catch (err: any) {
    console.error('Move files error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
