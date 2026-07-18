-- ============================================================
-- COMPARE PRODUCTS — MONTHLY USAGE CAP
-- Compare was previously unlimited for Premium users (each comparison is a
-- brand-new Gemini call with Search Grounding, same cost profile as a full
-- scan). This adds the same kind of monthly counter/reset pair that
-- scans_used_this_month / scans_reset_at already provide for scans, so
-- /api/compare can enforce a 20/month fair-use cap.
-- ============================================================
alter table public.users
  add column if not exists compares_used_this_month int not null default 0,
  add column if not exists compares_reset_at timestamptz not null default now();
