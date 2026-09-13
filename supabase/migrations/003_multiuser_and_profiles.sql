-- ============================================================
-- CloudVault / Simpenan — Multi-User, Profiles, & Storage Quotas
-- Supabase PostgreSQL Migration 003
-- ============================================================

-- 1. Profiles Table for Tier & Quota Management
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'founder', 'pro', 'creator')),
  is_lifetime BOOLEAN NOT NULL DEFAULT false,
  subscription_end_date TIMESTAMPTZ,
  storage_limit_bytes BIGINT NOT NULL DEFAULT 2147483648,  -- 2 GB for starter
  max_file_size_bytes BIGINT NOT NULL DEFAULT 262144000,    -- 250 MB for starter
  used_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Add user_id to files table
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index for user files
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_user_parent ON public.files(user_id, parent_path);

-- Drop old unique path index and scope to user_id
DROP INDEX IF EXISTS idx_files_unique_path;
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_user_path ON public.files(user_id, path);

-- 3. Transactions / Payment Orders Table for Paywuz
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'ALL',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'FAILED')),
  paywuz_tx_id TEXT,
  payment_url TEXT,
  qr_string TEXT,
  va_number TEXT,
  va_bank TEXT,
  payload JSONB,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role has full access to profiles" ON public.profiles;
CREATE POLICY "Service role has full access to profiles"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Payments RLS policies
DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to payments" ON public.payments;
CREATE POLICY "Service role has full access to payments"
  ON public.payments FOR ALL
  USING (auth.role() = 'service_role');

-- Files RLS policies
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access own files" ON public.files;
CREATE POLICY "Users can access own files"
  ON public.files FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Service role has full access to files" ON public.files;
CREATE POLICY "Service role has full access to files"
  ON public.files FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Trigger on auth.users to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier, is_lifetime, storage_limit_bytes, max_file_size_bytes)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    'starter',
    false,
    2147483648,   -- 2 GB
    262144000     -- 250 MB
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
