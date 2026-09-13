// ============================================================
// Supabase Frontend Client
// Resilient initialization with fallback and localStorage support
// ============================================================
import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://rqwuceybqsadneyjxmvy.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxd3VjZXlicXNhZG5leWp4bXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NTkxMjAsImV4cCI6MjEwNDQzNTEyMH0.n6FShmaWw46AAI0Opp4PTu2lyDnkP_1UbvMWxtTC4xY';

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
  return FALLBACK_ANON_KEY;
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
