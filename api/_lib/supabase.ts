// ============================================================
// Supabase Admin Client — Server-side only
// Uses the service role key for unrestricted DB access
// ============================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPA_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPA_KEY?.trim() || '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export async function getAuthUser(req: any): Promise<{ id: string; email?: string } | null> {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;

    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

