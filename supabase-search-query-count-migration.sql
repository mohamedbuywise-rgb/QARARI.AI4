-- ============================================================
-- AI COST DASHBOARD — REAL SEARCH-QUERY COUNT
-- The Dashboard used to add a flat $0.02-per-call guess for Google Search
-- Grounding cost, regardless of how many search queries a call actually
-- triggered. Gemini's response now gives us the real count via
-- groundingMetadata.webSearchQueries, so we store it per row and compute
-- grounding cost as (search_query_count * real per-query price) instead.
-- ============================================================
alter table public.ai_usage_log
  add column if not exists search_query_count int not null default 0;
