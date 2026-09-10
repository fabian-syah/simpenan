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
