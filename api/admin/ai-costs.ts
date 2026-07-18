import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isValidAdmin } from "./_auth.js";
import { getSupabaseAdmin } from "../_supabaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isValidAdmin(req)) return res.status(401).json({ error: "unauthorized" });

  const admin = getSupabaseAdmin();
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: monthRows, error: monthErr } = await admin
      .from("ai_usage_log")
      .select("model, endpoint, tier, total_tokens, estimated_cost_usd, created_at")
      .gte("created_at", startOfMonth);

    if (monthErr) return res.status(500).json({ error: "server_error" });

    const rows = monthRows || [];
    const totalCostThisMonth = rows.reduce((s, r: any) => s + Number(r.estimated_cost_usd || 0), 0);
    const totalCallsThisMonth = rows.length;
    const totalTokensThisMonth = rows.reduce((s, r: any) => s + Number(r.total_tokens || 0), 0);

    const byModel: Record<string, { calls: number; cost: number }> = {};
    const byEndpoint: Record<string, { calls: number; cost: number }> = {};
    for (const r of rows as any[]) {
      byModel[r.model] = byModel[r.model] || { calls: 0, cost: 0 };
      byModel[r.model].calls++;
      byModel[r.model].cost += Number(r.estimated_cost_usd || 0);

      byEndpoint[r.endpoint] = byEndpoint[r.endpoint] || { calls: 0, cost: 0 };
      byEndpoint[r.endpoint].calls++;
      byEndpoint[r.endpoint].cost += Number(r.estimated_cost_usd || 0);
    }

    // Last 14 days, bucketed by day, for a simple trend view.
    const { data: recentRows } = await admin
      .from("ai_usage_log")
      .select("estimated_cost_usd, created_at")
      .gte("created_at", fourteenDaysAgo);

    const byDay: Record<string, number> = {};
    for (const r of (recentRows || []) as any[]) {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + Number(r.estimated_cost_usd || 0);
    }
    const dailyTrend = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({ date, cost: Number(cost.toFixed(4)) }));

    const avgCostPerCall = totalCallsThisMonth ? Number((totalCostThisMonth / totalCallsThisMonth).toFixed(5)) : 0;

    return res.status(200).json({
      totalCostThisMonth: Number(totalCostThisMonth.toFixed(4)),
      totalCallsThisMonth,
      totalTokensThisMonth,
      avgCostPerCall,
      byModel,
      byEndpoint,
      dailyTrend,
      note: "Costs are ESTIMATED from a configured pricing table in api/_costTracking.ts — update it to match current Gemini pricing for accuracy.",
    });
  } catch (err) {
    console.error("[/api/admin/ai-costs] error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
