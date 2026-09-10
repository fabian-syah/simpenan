-- ============================================================
-- CloudVault — Initial Database Schema
-- Supabase PostgreSQL Migration
-- ============================================================

-- Storage providers registry
-- Tracks capacity and real-time usage across all cloud backends
CREATE TABLE IF NOT EXISTS storage_providers (
  id TEXT PRIMARY KEY,                     -- 'backblaze', 'filebase', 'supabase'
  display_name TEXT NOT NULL,
  max_bytes BIGINT NOT NULL,               -- Maximum free quota in bytes
  used_bytes BIGINT NOT NULL DEFAULT 0,    -- Current cumulative usage
  endpoint_url TEXT,                       -- S3-compatible endpoint URL
  bucket_name TEXT NOT NULL,
  region TEXT DEFAULT 'us-east-1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Files and folders metadata
-- Central index mapping virtual paths to cloud storage locations
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  path TEXT NOT NULL,                      -- Full virtual path: '/documents/report.pdf'
  parent_path TEXT NOT NULL DEFAULT '/',   -- Parent folder path for listing
  is_folder BOOLEAN DEFAULT false,
  size_bytes BIGINT DEFAULT 0,
  mime_type TEXT,
  provider_id TEXT REFERENCES storage_providers(id),
  storage_key TEXT,                        -- Object key in the provider's bucket
  checksum TEXT,                           -- SHA-256 hash for integrity verification
  chunk_count INTEGER DEFAULT 1,
  upload_id TEXT,                          -- S3 multipart upload ID (null for single-part)
  upload_status TEXT DEFAULT 'pending'
    CHECK (upload_status IN ('pending', 'uploading', 'complete', 'failed')),
  is_starred BOOLEAN DEFAULT false,
  is_trashed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes for performant queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_files_parent_path ON files(parent_path);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_unique_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_provider ON files(provider_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(upload_status);
CREATE INDEX IF NOT EXISTS idx_files_starred ON files(is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(is_trashed) WHERE is_trashed = true;

-- ============================================================
-- Seed default storage providers
-- Update endpoint_url and bucket_name to match your actual accounts
-- ============================================================
INSERT INTO storage_providers (id, display_name, max_bytes, bucket_name, endpoint_url, region)
VALUES
  ('backblaze',  'Backblaze B2',      10737418240, 'drive-clone-bb', 'https://s3.us-west-004.backblazeb2.com', 'us-west-004'),
  ('filebase',   'Filebase',           5368709120, 'drive-clone-fb', 'https://s3.filebase.com',                'us-east-1'),
  ('supabase',   'Supabase Storage',   1073741824, 'drive-files',    NULL,                                     NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Trigger: auto-update `updated_at` on row modification
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON storage_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
