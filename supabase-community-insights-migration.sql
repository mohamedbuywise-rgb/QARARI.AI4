-- ============================================================
-- COMMUNITY PRICE EVENTS (real social-proof layer)
-- Every time someone analyzes a product, we log the real offered price
-- they typed in. This is genuine data that already exists in every
-- /api/analyze call — we're just persisting it and surfacing it back to
-- later users of the same product, instead of fabricating fake numbers.
--
-- IMPORTANT: never show a fabricated count or invented "someone bought it
-- for X" story. If a product has too few real events, the UI must hide the
-- widget rather than make up a number — see api/analyze.ts.
-- ============================================================
create table if not exists public.product_price_events (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,           -- same normalized "product::currency" key as analysis_cache
  offered_price numeric not null,
  currency text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_price_events_cache_key_idx
  on public.product_price_events (cache_key, created_at desc);

-- No RLS needed: only ever written/read by the backend (Service Role Key).
-- No user identifiers are stored — this table is anonymous by design, since
-- it exists purely to compute an aggregate count/price range, never to
-- expose who submitted what.
