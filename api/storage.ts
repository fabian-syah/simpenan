// ============================================================
// /api/storage
// Consolidated storage endpoint:
// 1. action=quota (default): system storage breakdown + user personal quota
// 2. action=providers: list, add/update (POST), delete (DELETE) storage providers
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, getAuthUser } from './_lib/supabase.js';
import { testGDriveConnection } from './_lib/gdrive.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = (req.query.action as string) || (req.url?.includes('providers') ? 'providers' : 'quota');

  // ACTION: LOGIN (Backend Supabase Auth - No frontend anon key required)
  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email dan kata sandi wajib diisi' });
      }

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: String(email).trim(),
        password: String(password),
      });

      if (error) {
        return res.status(400).json({ error: error.message || 'Login gagal' });
      }

      return res.status(200).json({
        user: data.user,
        session: data.session,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  // ACTION: REGISTER (Auto confirmed by backend)
  if (action === 'register') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email dan kata sandi wajib diisi' });
      }

      const cleanEmail = String(email).trim();
      const cleanPassword = String(password);

      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
      });

      if (createError) {
        return res.status(400).json({ error: createError.message || 'Pendaftaran gagal' });
      }

      // Generate session immediately
      const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (loginError) {
        return res.status(200).json({
          user: createData.user,
          message: 'Akun berhasil dibuat. Silakan masuk.',
        });
      }

      return res.status(200).json({
        user: loginData.user,
        session: loginData.session,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  // ACTION: SESSION / CURRENT USER
  if (action === 'session' || action === 'me') {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) {
        return res.status(200).json({ user: null });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      return res.status(200).json({
        user: authUser,
        profile: profile || null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  // ACTION: PROVIDERS
  if (action === 'providers') {
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

    // POST: Add or update a storage provider
    if (req.method === 'POST') {
      try {
        const {
          id: customId,
          displayName,
          endpointUrl,
          maxBytes = 5497558138880,
          secret = 'simpenan_gdrive_secret_2026',
          bucketName = 'Simpenan Storage',
        } = req.body || {};

        if (!endpointUrl || !displayName) {
          return res.status(400).json({ error: 'displayName and endpointUrl are required' });
        }

        const cleanUrl = String(endpointUrl).trim();
        const testResult = await testGDriveConnection(cleanUrl, secret);
        if (!testResult.success) {
          return res.status(400).json({
            error: `Gagal menghubungkan ke Google Apps Script: ${testResult.error || 'Akses ditolak / URL salah'}`,
          });
        }

        let providerId = customId ? String(customId).trim().toLowerCase() : '';
        if (!providerId) {
          const { data: existingGdrive } = await supabaseAdmin
            .from('storage_providers')
            .select('id')
            .like('id', 'gdrive%');

          const count = (existingGdrive || []).length;
          providerId = count === 0 ? 'gdrive' : `gdrive_${count + 1}`;
        }

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
        return res.status(500).json({ error: 'Internal server error', details: err.message });
      }
    }

    // DELETE: Remove a storage provider
    if (req.method === 'DELETE') {
      try {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ error: 'Provider id is required' });

        const { count } = await supabaseAdmin
          .from('files')
          .select('id', { count: 'exact', head: true })
          .eq('provider_id', id);

        if (count && count > 0) {
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
  }

  // ACTION: QUOTA (default)
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data: providers, error } = await supabaseAdmin
      .from('storage_providers')
      .select('*')
      .eq('is_active', true)
      .order('max_bytes', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch quota', details: error.message });
    }

    // Accurately sum used_bytes from the files table
    const { data: filesData } = await supabaseAdmin
      .from('files')
      .select('provider_id, size_bytes')
      .eq('upload_status', 'complete')
      .eq('is_trashed', false);

    const realUsageMap: Record<string, number> = {};
    if (filesData) {
      for (const f of filesData) {
        if (f.provider_id) {
          realUsageMap[f.provider_id] = (realUsageMap[f.provider_id] || 0) + (Number(f.size_bytes) || 0);
        }
      }
    }

    const enrichedProviders = (providers || []).map((p: any) => {
      const realUsed = realUsageMap[p.id] !== undefined ? realUsageMap[p.id] : Number(p.used_bytes || 0);
      if (Number(p.used_bytes) !== realUsed) {
        supabaseAdmin
          .from('storage_providers')
          .update({ used_bytes: realUsed })
          .eq('id', p.id)
          .then();
      }
      return {
        ...p,
        used_bytes: realUsed,
      };
    });

    const totalMax = enrichedProviders.reduce((sum: number, p: any) => sum + (Number(p.max_bytes) || 0), 0);
    const totalUsed = enrichedProviders.reduce((sum: number, p: any) => sum + (Number(p.used_bytes) || 0), 0);

    // Also fetch personal user quota if authenticated
    let userQuota = null;
    const authUser = await getAuthUser(req);
    if (authUser) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const { data: userFiles } = await supabaseAdmin
        .from('files')
        .select('size_bytes')
        .eq('user_id', authUser.id)
        .eq('upload_status', 'complete')
        .eq('is_trashed', false);

      const userUsedBytes = (userFiles || []).reduce((acc: number, f: any) => acc + (Number(f.size_bytes) || 0), 0);

      const tier = profile?.tier || 'starter';
      const storageLimit = profile?.storage_limit_bytes || (tier === 'creator' ? 214748364800 : tier === 'pro' || tier === 'founder' ? 53687091200 : 2147483648);
      const maxFileSize = profile?.max_file_size_bytes || (tier === 'creator' ? 21474836480 : tier === 'pro' || tier === 'founder' ? 5368709120 : 262144000);

      userQuota = {
        userId: authUser.id,
        email: authUser.email,
        tier,
        isLifetime: profile?.is_lifetime || false,
        storageLimitBytes: storageLimit,
        maxFileSizeBytes: maxFileSize,
        usedBytes: userUsedBytes,
        usedPercentage: storageLimit > 0 ? Math.min(100, Math.round((userUsedBytes / storageLimit) * 100)) : 0,
      };
    }

    return res.status(200).json({
      providers: enrichedProviders,
      total_max_bytes: totalMax,
      total_used_bytes: totalUsed,
      user_quota: userQuota,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
