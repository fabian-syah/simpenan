// ============================================================
// GET /api/storage/quota
// Returns per-provider storage breakdown for quota visualization
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
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

      // Synchronize database row if discrepant
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

    return res.status(200).json({
      providers: enrichedProviders,
      total_max_bytes: totalMax,
      total_used_bytes: totalUsed,
    });
  } catch (err: any) {
    console.error('Quota error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
