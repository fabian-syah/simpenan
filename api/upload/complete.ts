// ============================================================
// POST /api/upload/complete
// Finalize an upload: complete multipart if needed, update metadata
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';
import { completeMultipartUpload } from '../_lib/storage-providers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileId, uploadId, parts, storageKey } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    // Fetch the file record
    const { data: file, error: fetchErr } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fetchErr || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // If multipart upload, complete it on the storage provider
    if (uploadId && parts && parts.length > 0 && file.provider_id !== 'supabase' && file.provider_id !== 'mega' && file.provider_id !== 'mediafire') {
      await completeMultipartUpload(
        file.provider_id,
        file.storage_key,
        uploadId,
        parts
      );
    }

    // Update file status to 'complete' (and update storage_key if provided, e.g. from MEGA)
    const updatePayload: any = { upload_status: 'complete' };
    if (storageKey) {
      updatePayload.storage_key = storageKey;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('files')
      .update(updatePayload)
      .eq('id', fileId);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update file status' });
    }

    // Update the provider's used_bytes accurately from files table
    try {
      const { data: sumFiles } = await supabaseAdmin
        .from('files')
        .select('size_bytes')
        .eq('provider_id', file.provider_id)
        .eq('upload_status', 'complete')
        .eq('is_trashed', false);

      const totalProviderBytes = (sumFiles || []).reduce(
        (acc: number, f: any) => acc + (Number(f.size_bytes) || 0),
        0
      );

      await supabaseAdmin
        .from('storage_providers')
        .update({ used_bytes: totalProviderBytes })
        .eq('id', file.provider_id);
    } catch (quotaErr) {
      console.warn('Quota update error:', quotaErr);
    }

    return res.status(200).json({ success: true, fileId });
  } catch (err: any) {
    console.error('Upload complete error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
