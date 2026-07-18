-- ============================================================
-- ANALYSIS CACHE (cost-saving layer)
-- Caches Gemini's market-research result per product+currency so that
-- repeated scans of the same popular product (e.g. "iPhone 15 Pro")
-- reuse the same AI + Search Grounding result instead of paying for a
-- brand-new call every single time. Each user's own offered price and
-- money-saved calculation is still computed fresh on top of the cached
-- market data, so the cache never shows a user someone else's numbers.
-- ============================================================
create table if not exists public.analysis_cache (
  cache_key text primary key,       -- normalized "product::currency"
  parsed jsonb not null,            -- the raw Gemini analysis payload (verdict, price range, etc.)
  model_used text not null,
  created_at timestamptz not null default now()
);

-- No RLS needed: this table is only ever touched by the backend
-- (Service Role Key), never directly by client-side anon/authenticated keys.
