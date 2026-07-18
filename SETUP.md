# Qarari.AI — Setup Guide (Real Backend Wired)

## What's now REAL (not mock data)

- `/api/analyze` — calls Gemini with search grounding, returns a real market-researched report. Enforces the Free/Premium tier prompt depth (Section 14A) and the 5-scan monthly limit server-side (Section 14), for both signed-in users and guests (tracked by IP).
- `/api/scans-remaining` — live scan counter used by the Decision Input screen and Profile screen (never goes negative, never resets on logout/login — only on a new month).
- Real Supabase Auth (sign up / sign in / sign out / session persistence) replacing the old fake in-memory login.
- Real History: saved reports are written to and read from the `analyses` table, tied to the account (not local state that resets on refresh).
- Real Premium subscription workflow (Section 15): screenshot uploads to Supabase Storage, creates a `pending_review` row, sends you a Telegram alert. **Upgrading to Premium now requires your admin approval — it is no longer instant.**
- Admin APIs: `/api/admin/login`, `/api/admin/requests`, `/api/admin/approve`, `/api/admin/reject` — protected by your `ADMIN_USERNAME`/`ADMIN_PASSWORD`.
- Real "Notify me if price drops" — saves a real row to the `watchlist` table, and is now actually checked daily (see below).
- **Admin Dashboard UI** — a real screen at `/admin`, gated by your admin username/password, with three tabs: pending subscription requests (approve/reject with signed screenshot links), Business Metrics (Section 26), and AI Cost Dashboard (Section 25).
- **Compare Products** — wired into the app for real: a "Compare" icon lives in the header, and the "Compare with another product" box on the Report screen now hands off into it. `/api/compare` calls Gemini with search grounding for a real researched comparison (Premium-gated server-side, not just in the UI).
- **Daily cron job** (`/api/cron/daily`, registered in `vercel.json`, runs once a day): auto-reverts expired Premium subscriptions to Free, proactively resets monthly scan counters, and checks the watchlist for real price drops (emailing users when a tracked product's price falls 5%+). Every run is logged to `cron_logs`.
- **AI Cost Dashboard & Business Metrics Dashboard** (Sections 25-26) — live at `/admin`. Cost figures are ESTIMATED from a configurable pricing table in `api/_costTracking.ts` (update it to match Gemini's current published pricing for accuracy) — actual billing always comes from Google Cloud.

## What's still NOT built yet (known gaps — tell me if you want these next)

- **Referral program, PDF export** — not built. The demo report and first-time flow in the UI still work as before.
- MRR figures on the Business Metrics dashboard are directional estimates (they assume all Premium users are on the monthly price for the headline MRR number) — fine for a small app, but not exact accounting.

## Setup steps

### 1. Run the database schema
Open your Supabase project → **SQL Editor** → paste the entire contents of `supabase-schema.sql` (included in this zip) → Run.
This now also creates `ai_usage_log` and `cron_logs`, and adds a few columns to `watchlist` — safe to re-run even if you ran an earlier version of this file before (everything uses `if not exists` / `add column if not exists`).

### 2. Create the Storage bucket
The SQL script already creates the `screenshots` bucket and its access policies — no manual step needed, just make sure the SQL ran without errors.

### 3. Get your Supabase ANON key (you only gave me the service role key before)
Supabase Dashboard → Project Settings → API → copy the **`anon` `public`** key (different from the service role key — this one is safe for the browser).

### 4. Set Environment Variables in Vercel
Go to your Vercel project → Settings → Environment Variables, and add:

```
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
RESEND_API_KEY=your_resend_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_admin_password
CRON_SECRET=any_long_random_string_you_make_up
VITE_ADMIN_ROUTE_SLUG=a_hard_to_guess_slug_like_qarari-2511k26x
```

`VITE_ADMIN_ROUTE_SLUG` is optional but recommended: it moves the Admin Dashboard from the guessable `/admin` to a secret path of your choosing (e.g. `/qarari-2511k26x`). It must have the `VITE_` prefix (unlike the other admin vars) because the router needs to read it in the browser to know which path to render the dashboard on. If you don't set it, the dashboard falls back to `/admin`.

Note: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are exposed to the browser on purpose (that's how Supabase client-side auth works) — this is safe and expected, unlike the service role key which must never have a `VITE_` prefix.

`CRON_SECRET` is new: make up any long random string. Vercel automatically sends it as a `Bearer` token on the daily cron trigger, and `/api/cron/daily` checks it — this is what stops a stranger from hitting that URL directly and firing off a batch of Gemini calls and emails on your dime.

### 5. Redeploy
Push this project to GitHub and import/redeploy on Vercel. The `/api` folder is automatically picked up as serverless functions — no extra config needed. The daily cron job is picked up automatically from `vercel.json` too (Vercel's free/Hobby plan supports one cron job running once a day, which is exactly what's configured).

### 6. Test the core loop
1. Sign up with a real email.
2. Run an analysis — it should take a few seconds (real Gemini + search grounding), not instant.
3. Use up all 5 free scans, confirm the 6th attempt blocks you and shows the upgrade screen.
4. Try subscribing — upload any screenshot, confirm it creates a request (check the `subscription_requests` table in Supabase, and check you got a Telegram message).
5. Go to `https://yourapp.vercel.app/admin`, log in with `ADMIN_USERNAME`/`ADMIN_PASSWORD`, and approve the request from the **Requests** tab — no more manual Postman calls needed.
6. Check the **Business Metrics** and **AI Cost** tabs on `/admin` — they should show your test user and the Gemini calls you just made.
7. As a Premium user, tap the Compare icon in the header (or "Compare with another product" on a report) and run a real comparison.
8. To manually test the cron job before waiting a day, you can trigger it yourself with:
   `curl -X POST https://yourapp.vercel.app/api/cron/daily -H "Authorization: Bearer YOUR_CRON_SECRET"`

