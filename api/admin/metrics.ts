import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isValidAdmin } from "./_auth.js";
import { getSupabaseAdmin } from "../_supabaseAdmin.js";

const MONTHLY_PRICE = 149;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isValidAdmin(req)) return res.status(401).json({ error: "unauthorized" });

  const admin = getSupabaseAdmin();
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      { count: totalUsers },
      { count: premiumUsers },
      { count: newSignupsWeek },
      { count: totalAnalyses },
      { count: analysesThisMonth },
      { data: moneySavedRows },
      { count: pendingRequests },
      { count: approvedThisMonth },
      { count: rejectedThisMonth },
      { data: activeSubs },
    ] = await Promise.all([
      admin.from("users").select("id", { count: "exact", head: true }),
      admin.from("users").select("id", { count: "exact", head: true }).eq("tier", "premium"),
      admin.from("users").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      admin.from("analyses").select("id", { count: "exact", head: true }),
      admin.from("analyses").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
      admin.from("users").select("total_money_saved"),
      admin.from("subscription_requests").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
      admin.from("subscription_requests").select("id", { count: "exact", head: true }).eq("status", "approved").gte("reviewed_at", startOfMonth),
      admin.from("subscription_requests").select("id", { count: "exact", head: true }).eq("status", "rejected").gte("reviewed_at", startOfMonth),
      admin.from("subscription_requests").select("plan").eq("status", "approved").gte("reviewed_at", startOfMonth),
    ]);

    const totalMoneySaved = (moneySavedRows || []).reduce((sum: number, r: any) => sum + Number(r.total_money_saved || 0), 0);

    // Rough MRR estimate: count of currently-premium users × monthly price.
    const mrrEstimate = (premiumUsers || 0) * MONTHLY_PRICE;

    const newMrrThisMonth = (activeSubs || []).reduce(
      (sum: number) => sum + MONTHLY_PRICE,
      0
    );

    const conversionRate = totalUsers ? Number((((premiumUsers || 0) / totalUsers) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      totalUsers: totalUsers || 0,
      premiumUsers: premiumUsers || 0,
      freeUsers: (totalUsers || 0) - (premiumUsers || 0),
      newSignupsThisWeek: newSignupsWeek || 0,
      conversionRate,
      totalAnalyses: totalAnalyses || 0,
      analysesThisMonth: analysesThisMonth || 0,
      totalMoneySaved,
      mrrEstimate,
      newMrrThisMonth: Number(newMrrThisMonth.toFixed(2)),
      pendingRequests: pendingRequests || 0,
      approvedThisMonth: approvedThisMonth || 0,
      rejectedThisMonth: rejectedThisMonth || 0,
    });
  } catch (err) {
    console.error("[/api/admin/metrics] error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
