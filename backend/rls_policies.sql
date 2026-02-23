-- ─────────────────────────────────────────────────────────────────────────────
-- rls_policies.sql
--
-- Run this in the Supabase SQL editor ONLY if you have RLS enabled on any of
-- the backend tables. By default Supabase disables RLS for newly created
-- tables; if you explicitly enabled it, apply these policies so the backend
-- service-role connection can read and write freely.
--
-- The backend connects using the direct PostgreSQL URI (service-role key
-- equivalent), so with RLS disabled these policies are unnecessary.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on each table first (only needed if not already enabled)
-- ALTER TABLE analyses          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE accounts          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rings             ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reports           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE review_requests   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rewards           ENABLE ROW LEVEL SECURITY;

-- Allow the backend full access on every table (all operations, all rows)

CREATE POLICY "Allow backend full access"
ON analyses
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow backend full access"
ON accounts
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow backend full access"
ON rings
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow backend full access"
ON reports
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow backend full access"
ON review_requests
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow backend full access"
ON rewards
FOR ALL
USING (true)
WITH CHECK (true);
