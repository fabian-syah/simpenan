-- ============================================================
-- CloudVault / Simpenan — Feedback & Bug Reports Schema
-- Supabase PostgreSQL Migration 002
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  contact TEXT,
  file_id UUID,
  file_name TEXT,
  page_path TEXT,
  user_agent TEXT,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying recent reports
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (so testers can submit feedback anonymously)
CREATE POLICY "Allow public insert to feedback"
  ON feedback
  FOR INSERT
  WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access on feedback"
  ON feedback
  FOR ALL
  USING (auth.role() = 'service_role');
