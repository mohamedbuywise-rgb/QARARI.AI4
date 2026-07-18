import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../_supabaseAdmin.js";
import { sendEmail } from "../_resend.js";
import { callGeminiWithFallback } from "../_gemini.js";
import { logAiUsage } from "../_costTracking.js";

const FREE_MONTHLY_LIMIT = 5;

// Verifies this request really came from Vercel Cron. Vercel automatically
// sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations once
// the CRON_SECRET env var is set — see SETUP.md.
function isValidCronRequest(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization;
  return auth === `Bearer ${secret}`;
}

// ---- 1. Auto-revert expired Premium subscriptions to Free (Section 16) ----
async function revertExpiredSubscriptions(admin: any) {
  const now = new Date().toISOString();
  const { data: expired, error } = await admin
    .from("users")
    .select("id, email, subscription_end_date")
    .eq("tier", "premium")
    .lt("subscription_end_date", now);

  if (error || !expired?.length) return { reverted: 0 };

  for (const u of expired) {
    await admin.from("users").update({ tier: "free" }).eq("id", u.id);
    await admin.from("admin_audit_log").insert({
      admin_identity: "cron",
      action_type: "subscription_expired_auto_revert",
      target_user_id: u.id,
      before_value: { tier: "premium" },
      after_value: { tier: "free" },
    });
    if (u.email) {
      await sendEmail(
        u.email,
        "انتهى اشتراكك في Qarari.AI Premium",
        `<p>انتهت صلاحية اشتراكك في بريميوم. جدّد اشتراكك للاستمرار في الاستفادة من المميزات الكاملة.</p>
         <p>Your Qarari.AI Premium subscription has expired. Renew to keep your full features.</p>`
      );
    }
  }
  return { reverted: expired.length };
}

// ---- 2. Proactively reset monthly free-scan counters (Section 14) ----
async function resetMonthlyScans(admin: any) {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data: usersToReset } = await admin
    .from("users")
    .select("id")
    .lt("scans_reset_at", startOfMonth)
    .gt("scans_used_this_month", 0);

  if (usersToReset?.length) {
    const ids = usersToReset.map((u: any) => u.id);
    await admin.from("users").update({ scans_used_this_month: 0, scans_reset_at: now.toISOString() }).in("id", ids);
  }

  const { data: guestsToReset } = await admin
    .from("guest_usage")
    .select("ip_address")
    .lt("scans_reset_at", startOfMonth)
    .gt("scans_used_this_month", 0);

  if (guestsToReset?.length) {
    const ips = guestsToReset.map((g: any) => g.ip_address);
    await admin.from("guest_usage").update({ scans_used_this_month: 0, scans_reset_at: now.toISOString() }).in("ip_address", ips);
  }

  return { usersReset: usersToReset?.length || 0, guestsReset: guestsToReset?.length || 0 };
}

// ---- 3. Real price-drop checking for the watchlist (Section 18) ----
async function checkWatchlistPriceDrops(admin: any) {
  const { data: rows, error } = await admin
    .from("watchlist")
    .select("*, users(email)")
    .eq("active", true)
    .is("notified_at", null);

  if (error || !rows?.length) return { checked: 0, notified: 0 };

  let notified = 0;

  // Cap per run so a single cron invocation can't run away with Gemini cost/time.
  const batch = rows.slice(0, 25);

  for (const row of batch) {
    try {
      const prompt = `Research the CURRENT real market price for this product and return ONLY a JSON object: {"fairPriceMid": number}.
PRODUCT: ${row.product}
CURRENCY: ${row.currency}`;

      const geminiResult = await callGeminiWithFallback(prompt);
      await logAiUsage(admin, {
        endpoint: "cron_price_check",
        model: geminiResult.modelUsed,
        tier: "premium",
        userId: row.user_id,
        usage: geminiResult.usage,
      });

      const currentPrice = Number(geminiResult.data?.fairPriceMid);
      if (!currentPrice || Number.isNaN(currentPrice)) continue;

      await admin
        .from("watchlist")
        .update({ last_checked_price: currentPrice, last_checked_at: new Date().toISOString() })
        .eq("id", row.id);

      // A meaningful drop = at least 5% below the price saved when they added it.
      const dropThreshold = row.saved_price * 0.95;
      if (currentPrice <= dropThreshold && row.users?.email) {
        await sendEmail(
          row.users.email,
          `نزل سعر ${row.product}! — Qarari.AI`,
          `<p>السعر الحالي المقدّر لـ ${row.product} أصبح ${currentPrice.toLocaleString()} ${row.currency}، أقل من ${row.saved_price.toLocaleString()} ${row.currency} اللي كنت متابعه.</p>
           <p>The estimated price for ${row.product} dropped to ${currentPrice.toLocaleString()} ${row.currency}, down from your saved ${row.saved_price.toLocaleString()} ${row.currency}.</p>`
        );
        await admin.from("watchlist").update({ notified_at: new Date().toISOString() }).eq("id", row.id);
        notified++;
      }
    } catch (e) {
      console.error(`[cron] watchlist check failed for row ${row.id}:`, e);
    }
  }

  return { checked: batch.length, notified };
}

// ---- 2b. Proactively reset monthly compare counters (Section 15's 10/month cap) ----
async function resetMonthlyCompares(admin: any) {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data: usersToReset } = await admin
    .from("users")
    .select("id")
    .lt("compares_reset_at", startOfMonth)
    .gt("compares_used_this_month", 0);

  if (usersToReset?.length) {
    const ids = usersToReset.map((u: any) => u.id);
    await admin.from("users").update({ compares_used_this_month: 0, compares_reset_at: now.toISOString() }).in("id", ids);
  }

  return { usersReset: usersToReset?.length || 0 };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isValidCronRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const admin = getSupabaseAdmin();
  const summary: Record<string, unknown> = {};

  try {
    summary.subscriptions = await revertExpiredSubscriptions(admin);
  } catch (e) {
    console.error("[cron] revertExpiredSubscriptions failed:", e);
    summary.subscriptions = { error: String(e) };
  }

  try {
    summary.scanResets = await resetMonthlyScans(admin);
  } catch (e) {
    console.error("[cron] resetMonthlyScans failed:", e);
    summary.scanResets = { error: String(e) };
  }

  try {
    summary.compareResets = await resetMonthlyCompares(admin);
  } catch (e) {
    console.error("[cron] resetMonthlyCompares failed:", e);
    summary.compareResets = { error: String(e) };
  }

  try {
    summary.watchlist = await checkWatchlistPriceDrops(admin);
  } catch (e) {
    console.error("[cron] checkWatchlistPriceDrops failed:", e);
    summary.watchlist = { error: String(e) };
  }

  await admin.from("cron_logs").insert({ job_name: "daily", summary });

  return res.status(200).json({ success: true, summary });
}
