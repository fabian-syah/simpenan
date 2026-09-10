// ============================================================
// DELETE /api/files/delete
// Permanent deletion: Removes files and folders recursively from
// cloud storage backends (Backblaze, Filebase, Supabase) and database
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';
import { deleteObject } from '../_lib/storage-providers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ error: 'fileId is required' });

    // Fetch the target file or folder
    const { data: file, error: fetchErr } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    // Idempotent: If already deleted, return success immediately
    if (fetchErr || !file) {
      return res.status(200).json({ success: true, message: 'Already deleted' });
    }

    const supaBucket = process.env.SUPA_BUCKET || 'drive-clone-supa-1';
    const bytesToSubtract: Record<string, number> = {
      backblaze: 0,
      filebase: 0,
      supabase: 0,
      mega: 0,
      mediafire: 0,
    };

    if (file.is_folder) {
      // 1. RECURSIVE FOLDER DELETION
      // Find all descendants of this folder
      const { data: descendants } = await supabaseAdmin
        .from('files')
        .select('*')
        .like('path', `${file.path}/%`);

      const allItems = [file, ...(descendants || [])];
      const allIds = allItems.map((item) => item.id);
      const variantParentPaths = allIds.map((id) => `.variants/${id}`);

      // Fetch video variants if any
      let variants: any[] = [];
      if (variantParentPaths.length > 0) {
        const { data: varData } = await supabaseAdmin
          .from('files')
          .select('*')
          .in('parent_path', variantParentPaths);
        variants = varData || [];
      }

      // STEP 1: IMMEDIATELY DELETE ALL RECORDS FROM DATABASE
      // This ensures any concurrent list/poll query immediately sees the items gone
      if (variantParentPaths.length > 0) {
        await supabaseAdmin.from('files').delete().in('parent_path', variantParentPaths);
      }
      await supabaseAdmin.from('files').delete().eq('id', file.id);
      await supabaseAdmin.from('files').delete().like('path', `${file.path}/%`);

      // STEP 2: CONCURRENT PHYSICAL DELETION FROM CLOUD STORAGE (Backblaze, Filebase, Supabase, MEGA, MediaFire)
      const storageDeletions: Promise<any>[] = [];
      for (const item of [...allItems, ...variants]) {
        if (!item.is_folder && item.storage_key && item.provider_id) {
          if (bytesToSubtract[item.provider_id] !== undefined) {
            bytesToSubtract[item.provider_id] += Number(item.size_bytes || 0);
          }
          if (item.provider_id === 'supabase') {
            storageDeletions.push(
              supabaseAdmin.storage.from(supaBucket).remove([item.storage_key]).catch((err) => {
                console.warn(`Supabase storage delete warning for ${item.storage_key}:`, err?.message);
              })
            );
          } else if (item.provider_id === 'mega') {
            storageDeletions.push(
              import('../_lib/mega.js').then(({ deleteMegaFile }) => deleteMegaFile(item.storage_key)).catch((err) => {
                console.warn(`MEGA storage delete warning for ${item.storage_key}:`, err?.message);
              })
            );
          } else if (item.provider_id === 'mediafire') {
            storageDeletions.push(
              import('../_lib/mediafire.js').then(({ deleteMediaFireFile }) => deleteMediaFireFile(item.storage_key)).catch((err) => {
                console.warn(`MediaFire storage delete warning for ${item.storage_key}:`, err?.message);
              })
            );
          } else {
            storageDeletions.push(
              deleteObject(item.provider_id, item.storage_key).catch((err) => {
                console.warn(`Storage delete warning for ${item.provider_id} ${item.storage_key}:`, err?.message);
              })
            );
          }
        }
      }

      await Promise.allSettled(storageDeletions);

    } else {
      // 2. SINGLE FILE PERMANENT DELETION
      const variantParentPath = `.variants/${file.id}`;
      const { data: variants } = await supabaseAdmin
        .from('files')
        .select('*')
        .eq('parent_path', variantParentPath);

      // STEP 1: IMMEDIATELY DELETE FROM DATABASE
      // Ensures 0ms consistency with list queries
      await supabaseAdmin.from('files').delete().eq('parent_path', variantParentPath);
      const { error: delErr } = await supabaseAdmin
        .from('files')
        .delete()
        .eq('id', fileId);

      if (delErr) {
        return res.status(500).json({ error: 'Failed to delete file record', details: delErr.message });
      }

      // STEP 2: CONCURRENT PHYSICAL STORAGE DELETION (Backblaze, Filebase, Supabase)
      const storageDeletions: Promise<any>[] = [];
      if (file.storage_key && file.provider_id) {
        if (bytesToSubtract[file.provider_id] !== undefined) {
          bytesToSubtract[file.provider_id] += Number(file.size_bytes || 0);
        }
        if (file.provider_id === 'supabase') {
          storageDeletions.push(
            supabaseAdmin.storage.from(supaBucket).remove([file.storage_key]).catch((err) => {
              console.warn('Supabase storage delete warning:', err?.message);
            })
          );
        } else if (file.provider_id === 'mega') {
          storageDeletions.push(
            import('../_lib/mega.js').then(({ deleteMegaFile }) => deleteMegaFile(file.storage_key)).catch((err) => {
              console.warn('MEGA storage delete warning:', err?.message);
            })
          );
        } else if (file.provider_id === 'mediafire') {
          storageDeletions.push(
            import('../_lib/mediafire.js').then(({ deleteMediaFireFile }) => deleteMediaFireFile(file.storage_key)).catch((err) => {
              console.warn('MediaFire storage delete warning:', err?.message);
            })
          );
        } else {
          storageDeletions.push(
            deleteObject(file.provider_id, file.storage_key).catch((err) => {
              console.warn(`Storage delete warning for ${file.provider_id}:`, err?.message);
            })
          );
        }
      }

      if (variants && variants.length > 0) {
        for (const v of variants) {
          if (v.storage_key && v.provider_id) {
            if (v.provider_id === 'supabase') {
              storageDeletions.push(
                supabaseAdmin.storage.from(supaBucket).remove([v.storage_key]).catch((err) => {
                  console.warn('Variant delete warning:', err?.message);
                })
              );
            } else if (v.provider_id === 'mega') {
              storageDeletions.push(
                import('../_lib/mega.js').then(({ deleteMegaFile }) => deleteMegaFile(v.storage_key)).catch((err) => {
                  console.warn('Variant delete warning:', err?.message);
                })
              );
            } else if (v.provider_id === 'mediafire') {
              storageDeletions.push(
                import('../_lib/mediafire.js').then(({ deleteMediaFireFile }) => deleteMediaFireFile(v.storage_key)).catch((err) => {
                  console.warn('Variant delete warning:', err?.message);
                })
              );
            } else {
              storageDeletions.push(
                deleteObject(v.provider_id, v.storage_key).catch((err) => {
                  console.warn('Variant delete warning:', err?.message);
                })
              );
            }
          }
        }
      }

      await Promise.allSettled(storageDeletions);
    }

    // 3. Update quotas accurately in storage_providers table
    for (const [provId] of Object.entries(bytesToSubtract)) {
      try {
        const { data: sumFiles } = await supabaseAdmin
          .from('files')
          .select('size_bytes')
          .eq('provider_id', provId)
          .eq('upload_status', 'complete')
          .eq('is_trashed', false);

        const totalRemaining = (sumFiles || []).reduce(
          (acc: number, f: any) => acc + (Number(f.size_bytes) || 0),
          0
        );

        await supabaseAdmin
          .from('storage_providers')
          .update({ used_bytes: totalRemaining })
          .eq('id', provId);
      } catch (qErr) {
        console.warn('Quota sync after delete error:', qErr);
      }
    }

    return res.status(200).json({ success: true, action: 'permanently_deleted' });
  } catch (err: any) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
