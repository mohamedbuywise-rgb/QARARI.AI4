-- ============================================================
-- QARARI.AI — SUPABASE DATABASE SCHEMA
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- ============================================================

-- 1. USERS TABLE (extends Supabase Auth's built-in auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  age text,
  country text,
  phone text,
  interests text[] default '{}',
  tier text not null default 'free' check (tier in ('free', 'premium')),
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  scans_used_this_month int not null default 0,
  scans_reset_at timestamptz not null default now(),
  compares_used_this_month int not null default 0,
  compares_reset_at timestamptz not null default now(),
  referral_code text unique,
  referred_by uuid references public.users(id),
  invite_count int not null default 0,
  total_money_saved numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 2. ANALYSIS HISTORY TABLE
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product text not null,
  offered_price numeric not null,
  currency text not null,
  verdict text not null,
  market_fair_price_min numeric not null,
  market_fair_price_max numeric not null,
  market_fair_price_mid numeric not null,
  money_saved numeric not null default 0,
  full_report jsonb not null, -- the complete bilingual AnalysisResult object
  feedback text, -- 'up' | 'down' | null
  feedback_comment text,
  created_at timestamptz not null default now()
);

-- 3. SUBSCRIPTION REQUESTS TABLE (Manual InstaPay workflow)
create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'annual')),
  amount numeric not null,
  screenshot_url text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  reject_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. WATCHLIST TABLE (price-drop notifications)
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product text not null,
  saved_price numeric not null,
  currency text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5. AUDIT LOG TABLE (admin actions)
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_identity text not null,
  action_type text not null,
  target_user_id uuid references public.users(id),
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

-- 6. GUEST USAGE TABLE (tracks free scans for non-signed-in visitors by IP)
create table if not exists public.guest_usage (
  ip_address text primary key,
  scans_used_this_month int not null default 0,
  scans_reset_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No RLS needed here — this table is only ever touched by the backend
-- (service role key), never queried directly from the browser.

-- 7. AI USAGE LOG (Section 25 — AI Cost Dashboard). One row per real Gemini
-- call from /api/analyze or /api/compare, with an ESTIMATED cost (see
-- api/_costTracking.ts) — for a directional dashboard, not an exact invoice.
create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null, -- 'analyze' | 'compare'
  model text not null,
  tier text not null, -- 'free' | 'premium' | 'guest'
  user_id uuid references public.users(id) on delete set null,
  prompt_tokens int not null default 0,
  output_tokens int not null default 0,
  total_tokens int not null default 0,
  estimated_cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_log_created_at_idx on public.ai_usage_log (created_at);

-- 8. CRON RUN LOG (observability for the daily scheduled job)
create table if not exists public.cron_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  summary jsonb not null default '{}',
  ran_at timestamptz not null default now()
);

-- 9. Extend watchlist with the fields the real daily price-check cron needs
alter table public.watchlist add column if not exists last_checked_price numeric;
alter table public.watchlist add column if not exists last_checked_at timestamptz;
alter table public.watchlist add column if not exists notified_at timestamptz;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — critical for security
-- ============================================================
alter table public.users enable row level security;
alter table public.analyses enable row level security;
alter table public.subscription_requests enable row level security;
alter table public.watchlist enable row level security;

-- Users can only read/update their own profile row
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Users can only see/insert their own analyses
create policy "Users can view own analyses" on public.analyses
  for select using (auth.uid() = user_id);
create policy "Users can insert own analyses" on public.analyses
  for insert with check (auth.uid() = user_id);

-- Users can only see/insert their own subscription requests
create policy "Users can view own subscription requests" on public.subscription_requests
  for select using (auth.uid() = user_id);
create policy "Users can insert own subscription requests" on public.subscription_requests
  for insert with check (auth.uid() = user_id);

-- Users can manage their own watchlist
create policy "Users can view own watchlist" on public.watchlist
  for select using (auth.uid() = user_id);
create policy "Users can insert own watchlist" on public.watchlist
  for insert with check (auth.uid() = user_id);
create policy "Users can update own watchlist" on public.watchlist
  for update using (auth.uid() = user_id);

-- Note: the backend uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely —
-- that's expected and required for the admin dashboard and /api/analyze quota checks.

-- ============================================================
-- STORAGE BUCKET SETUP (do this in Supabase Dashboard, not SQL Editor)
-- ============================================================
-- 1. Go to Storage → Create a new bucket named "screenshots" → set it to Private.
-- 2. Run the two policies below in the SQL Editor to let signed-in users
--    upload only into their own folder, named after their user id.

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

create policy "Users can upload own screenshots"
on storage.objects for insert
with check (
  bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own screenshots"
on storage.objects for select
using (
  bucket_id = 'screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- AUTO-CREATE public.users ROW WHEN SOMEONE SIGNS UP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, referral_code)
  values (
    new.id,
    new.email,
    substr(md5(random()::text), 1, 8)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
