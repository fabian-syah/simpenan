// ============================================================
// /api/storage/providers
// Manage multiple storage provider accounts (add Google Drive, list, remove)
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';
import { testGDriveConnection } from '../_lib/gdrive.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: List all storage providers
  if (req.method === 'GET') {
    try {
      const { data: providers, error } = await supabaseAdmin
        .from('storage_providers')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch providers', details: error.message });
      }

      return res.status(200).json({ providers: providers || [] });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  // POST: Add or update a storage provider (e.g. new Google Drive account)
  if (req.method === 'POST') {
    try {
      const {
        id: customId,
        displayName,
        endpointUrl,
        maxBytes = 5497558138880, // Default 5 TB
        secret = 'simpenan_gdrive_secret_2026',
        bucketName = 'Simpenan Storage',
      } = req.body || {};

      if (!endpointUrl || !displayName) {
        return res.status(400).json({ error: 'displayName and endpointUrl are required' });
      }

      const cleanUrl = String(endpointUrl).trim();

      // Test connection with Google Apps Script Web App
      const testResult = await testGDriveConnection(cleanUrl, secret);
      if (!testResult.success) {
        return res.status(400).json({
          error: `Gagal menghubungkan ke Google Apps Script: ${testResult.error || 'Akses ditolak / URL salah'}`,
        });
      }

      // Determine provider ID
      let providerId = customId ? String(customId).trim().toLowerCase() : '';
      if (!providerId) {
        // Query existing gdrive providers to find next available index
        const { data: existingGdrive } = await supabaseAdmin
          .from('storage_providers')
          .select('id')
          .like('id', 'gdrive%');

        const count = (existingGdrive || []).length;
        providerId = count === 0 ? 'gdrive' : `gdrive_${count + 1}`;
      }

      // Ensure providerId is valid identifier
      providerId = providerId.replace(/[^a-z0-9_]/g, '_');

      const actualMaxBytes = Number(testResult.maxBytes) || Number(maxBytes) || 5497558138880;

      const { data: provider, error: insertErr } = await supabaseAdmin
        .from('storage_providers')
        .upsert({
          id: providerId,
          display_name: displayName.trim(),
          max_bytes: actualMaxBytes,
          used_bytes: 0,
          endpoint_url: cleanUrl,
          bucket_name: bucketName,
          region: 'global',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) {
        return res.status(500).json({ error: 'Failed to register provider', details: insertErr.message });
      }

      return res.status(200).json({
        success: true,
        message: `Akun Google Drive '${displayName}' berhasil dihubungkan!`,
        provider,
      });
    } catch (err: any) {
      console.error('Add provider error:', err);
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  // DELETE: Remove a storage provider
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Provider id is required' });

      // Check if files exist for this provider
      const { count } = await supabaseAdmin
        .from('files')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', id);

      if (count && count > 0) {
        // Set inactive instead of deleting to prevent foreign key violation
        await supabaseAdmin
          .from('storage_providers')
          .update({ is_active: false })
          .eq('id', id);

        return res.status(200).json({
          success: true,
          message: `Provider ${id} dinonaktifkan (masih terdapat ${count} berkas tersimpan).`,
        });
      }

      const { error: delErr } = await supabaseAdmin
        .from('storage_providers')
        .delete()
        .eq('id', id);

      if (delErr) {
        return res.status(500).json({ error: 'Failed to delete provider', details: delErr.message });
      }

      return res.status(200).json({ success: true, message: `Provider ${id} berhasil dihapus.` });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
