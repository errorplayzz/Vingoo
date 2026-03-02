-- Migration 002: Right to Defense fields on accounts table
-- Run manually: psql -d <your_db> -f migrations/002_right_to_defense.sql

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS review_status        VARCHAR(50)  NOT NULL DEFAULT 'FLAGGED',
  ADD COLUMN IF NOT EXISTS defense_statement    TEXT,
  ADD COLUMN IF NOT EXISTS defense_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_decision      TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at          TIMESTAMPTZ;

-- Index for admin queries: show all UNDER_REVIEW accounts across analyses
CREATE INDEX IF NOT EXISTS ix_accounts_review_status
  ON accounts (review_status, analysis_id);
