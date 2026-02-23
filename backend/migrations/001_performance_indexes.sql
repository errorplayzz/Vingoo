-- 001_performance_indexes.sql
-- Apply to existing databases that were created before models_db.py added __table_args__.
-- Uses CREATE INDEX CONCURRENTLY so no table lock is held during build (safe in production).
-- Run with: psql $DATABASE_URL -f 001_performance_indexes.sql
-- Or via Supabase SQL editor (remove CONCURRENTLY – it is not supported inside a transaction).

-- ---------------------------------------------------------------------------
-- accounts: cover (analysis_id, suspicion_score) for sorted admin queries
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_accounts_analysis_score
    ON accounts (analysis_id, suspicion_score DESC);

-- accounts: lookup by ring_id within an analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_accounts_ring_id_cover
    ON accounts (ring_id, analysis_id);

-- ---------------------------------------------------------------------------
-- rings: cover (analysis_id, risk_score) for sorted admin queries
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_rings_analysis_risk
    ON rings (analysis_id, risk_score DESC);

-- ---------------------------------------------------------------------------
-- reports: status-filtered admin list views (pending / approved / rejected)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_reports_status_submitted
    ON reports (status, submitted_at DESC);

-- ---------------------------------------------------------------------------
-- review_requests: status-filtered admin list views
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_reviews_status_submitted
    ON review_requests (status, submitted_at DESC);

-- ---------------------------------------------------------------------------
-- analyses: BRIN index on created_at for time-range queries
-- (BRIN is ~100x smaller than B-tree for monotonically increasing timestamps)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analyses_created_at_brin
    ON analyses USING brin (created_at);
