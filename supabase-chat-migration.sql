-- ============================================================
-- REPORT CHAT USAGE (cost-cap layer for "Ask Assistant")
-- Every question sent through the chat bubble on the Report screen is a
-- brand-new Gemini call, so it needs the same kind of hard cap that
-- /api/analyze already enforces for full scans. This table tracks how many
-- chat messages have been asked per analysis (report_id) per identity
-- (signed-in user OR guest IP), so the limit survives page reloads and
-- can't be bypassed by just refreshing the chat panel.
-- ============================================================
create table if not exists public.chat_usage (
  report_id text not null,          -- the analysis/report id the chat is attached to
  identity text not null,           -- either "user:<uuid>" or "ip:<address>"
  messages_used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (report_id, identity)
);

-- No RLS needed: this table is only ever touched by the backend
-- (Service Role Key), never directly by client-side anon/authenticated keys.
