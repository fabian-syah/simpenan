// ============================================================
// Supabase Frontend Client
// Resilient initialization with fallback and localStorage support
// ============================================================
import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://rqwuceybqsadneyjxmvy.supabase.co';

const getInitialUrl = (): string => {
  return import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
};

const getInitialAnonKey = (): string => {
  if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return import.meta.env.VITE_SUPABASE_ANON_KEY;
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cv_supabase_anon_key');
    if (saved && saved.trim()) return saved.trim();
  }
  return 'placeholder_anon_key';
};

export const supabaseUrl = getInitialUrl();
export const supabaseAnonKey = getInitialAnonKey();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseAnonKey !== 'placeholder_anon_key' &&
    supabaseAnonKey !== 'your-anon-key'
  );
};

export const saveAnonKeyToStorage = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cv_supabase_anon_key', key.trim());
    window.location.reload();
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
