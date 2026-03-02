-- =============================================================================
-- 001_performance_indexes.sql
-- Performance indexes for all VINGOO tables.
-- Apply to existing databases that were created before models_db.py added
-- __table_args__ index declarations.
-- =============================================================================
--
-- HOW TO RUN:
--   GUI tools / Supabase SQL Editor / pgAdmin → paste the whole file and Run.
--   psql →  psql "$DATABASE_URL" -f 001_performance_indexes.sql
--
-- All statements are idempotent (IF NOT EXISTS) so re-running is always safe.
--
-- NOTE ON CONCURRENTLY:
--   CONCURRENTLY avoids table locks but cannot run inside a transaction block
--   (ERROR 25001).  GUI tools wrap scripts in implicit transactions, so this
--   file uses plain CREATE INDEX which works everywhere.  For large production
--   tables where zero downtime is required, run each statement through psql
--   (which uses autocommit) and add CONCURRENTLY back.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE: analyses
-- ---------------------------------------------------------------------------

-- BRIN index on created_at for time-range queries.
-- BRIN is ~100x smaller than B-tree for monotonically increasing timestamps.
CREATE INDEX IF NOT EXISTS ix_analyses_created_at_brin
    ON analyses USING brin (created_at);


-- ---------------------------------------------------------------------------
-- TABLE: accounts
-- ---------------------------------------------------------------------------

-- Auto-index from SQLAlchemy index=True on analysis_id column.
CREATE INDEX IF NOT EXISTS ix_accounts_analysis_id
    ON accounts (analysis_id);

-- Auto-index on account_id for cross-analysis lookups.
CREATE INDEX IF NOT EXISTS ix_accounts_account_id
    ON accounts (account_id);

-- Composite: filter by analysis_id, sort by suspicion_score DESC.
-- Covers admin_get_analysis and "top N accounts" queries.
CREATE INDEX IF NOT EXISTS ix_accounts_analysis_score
    ON accounts (analysis_id, suspicion_score DESC);

-- Composite: look up which ring an account belongs to across analyses.
CREATE INDEX IF NOT EXISTS ix_accounts_ring_id_cover
    ON accounts (ring_id, analysis_id);


-- ---------------------------------------------------------------------------
-- TABLE: rings
-- ---------------------------------------------------------------------------

-- Auto-index on analysis_id.
CREATE INDEX IF NOT EXISTS ix_rings_analysis_id
    ON rings (analysis_id);

-- Auto-index on ring_id for direct ring lookups.
CREATE INDEX IF NOT EXISTS ix_rings_ring_id
    ON rings (ring_id);

-- Composite: filter by analysis_id, sort by risk_score DESC.
CREATE INDEX IF NOT EXISTS ix_rings_analysis_risk
    ON rings (analysis_id, risk_score DESC);


-- ---------------------------------------------------------------------------
-- TABLE: reports
-- ---------------------------------------------------------------------------

-- Auto-index on report_id (unique column).
CREATE INDEX IF NOT EXISTS ix_reports_report_id
    ON reports (report_id);

-- Auto-index on suspect_account_id – "find all reports for an account".
CREATE INDEX IF NOT EXISTS ix_reports_suspect_account_id
    ON reports (suspect_account_id);

-- Composite: status-filtered admin list views (pending / approved / rejected).
CREATE INDEX IF NOT EXISTS ix_reports_status_submitted
    ON reports (status, submitted_at DESC);


-- ---------------------------------------------------------------------------
-- TABLE: ml_features
-- ---------------------------------------------------------------------------

-- Scheduler reads most-recent rows: ORDER BY recorded_at DESC LIMIT n
-- resolves O(LIMIT) instead of O(table_size).
CREATE INDEX IF NOT EXISTS ix_ml_features_recorded_at
    ON ml_features (recorded_at DESC);

-- Cascade support: quickly find all feature rows for a given analysis.
CREATE INDEX IF NOT EXISTS ix_ml_features_analysis_id
    ON ml_features (analysis_id);


-- ---------------------------------------------------------------------------
-- TABLE: review_requests
-- ---------------------------------------------------------------------------

-- Auto-index on review_id (unique column).
CREATE INDEX IF NOT EXISTS ix_review_requests_review_id
    ON review_requests (review_id);

-- Auto-index on account_id for per-account review history.
CREATE INDEX IF NOT EXISTS ix_review_requests_account_id
    ON review_requests (account_id);

-- Composite: status-filtered admin list views + recency sort.
CREATE INDEX IF NOT EXISTS ix_reviews_status_submitted
    ON review_requests (status, submitted_at DESC);


-- ---------------------------------------------------------------------------
-- TABLE: rewards
-- ---------------------------------------------------------------------------

-- report_id_fk has a UNIQUE constraint (implicit index), but an explicit named
-- index makes it easier to track in pg_indexes and drop if needed.
CREATE INDEX IF NOT EXISTS ix_rewards_report_id_fk
    ON rewards (report_id_fk);


-- =============================================================================
-- Verification – run after all indexes are created:
-- =============================================================================
--
-- SELECT indexname, tablename, indexdef
-- FROM   pg_indexes
-- WHERE  schemaname = 'public'
--   AND  indexname LIKE 'ix_%'
-- ORDER  BY tablename, indexname;
--
-- =============================================================================
