import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, getAuthedUser } from "./_supabaseAdmin.js";
import { callGeminiWithFallback } from "./_gemini.js";
import { logAiUsage } from "./_costTracking.js";

// Fair-use cap for paid subscribers — Compare used to be unlimited, but each
// comparison is a full Gemini call with Search Grounding (same cost as a
// scan), so it needs the same kind of monthly ceiling /api/analyze enforces.
const COMPARE_MONTHLY_LIMIT = 10;

function buildComparePrompt(productA: string, productB: string, priceA: number, priceB: number, currency: string) {
  return `You are a purchase-decision analyst with real-time web search access. Research CURRENT real market data for these two products and produce a structured JSON comparison.

PRODUCT A: ${productA} — offered price ${priceA} ${currency}
PRODUCT B: ${productB} — offered price ${priceB} ${currency}

Return a JSON object with EXACTLY this shape (all text fields must have both "ar" and "en" versions, natural fluent Arabic and English — not machine-translated):

{
  "rows": [
    { "category": {"ar":string,"en":string}, "valueA": {"ar":string,"en":string}, "valueB": {"ar":string,"en":string}, "winner": "A" | "B" | "tie" }
  ],
  "finalRecommendation": { "ar": string, "en": string }
}

Rules:
- Include at least 5 comparison rows covering: price value, build/quality, performance, future compatibility/longevity, and overall value for money.
- "winner" must be based on real researched facts about these specific products, never random.
- finalRecommendation must weigh both the researched facts and the two offered prices (${priceA} ${currency} vs ${priceB} ${currency}).
- Return ONLY the JSON object, nothing else.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { productA, productB, priceA, priceB, currency } = req.body || {};

    if (
      !productA || typeof productA !== "string" ||
      !productB || typeof productB !== "string" ||
      !priceA || Number(priceA) <= 0 ||
      !priceB || Number(priceB) <= 0
    ) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const admin = getSupabaseAdmin();
    const user = await getAuthedUser(req);

    // Compare Products is a Premium-only feature (Section 15) — enforce
    // server-side too, never trust the client-side gate alone.
    if (!user) {
      return res.status(401).json({ error: "auth_required" });
    }

    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("tier, subscription_end_date, compares_used_this_month, compares_reset_at")
      .eq("id", user.id)
      .single();

    if (userErr || !userRow) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const now = new Date();
    let tier: "free" | "premium" = userRow.tier;
    if (tier === "premium" && userRow.subscription_end_date && new Date(userRow.subscription_end_date) < now) {
      tier = "free";
      await admin.from("users").update({ tier: "free" }).eq("id", user.id);
    }

    if (tier !== "premium") {
      return res.status(403).json({ error: "premium_required" });
    }

    // Reset the counter if we've rolled into a new calendar month since the
    // last reset (same logic /api/analyze uses for scans_reset_at).
    const resetAt = new Date(userRow.compares_reset_at);
    const needsReset = now.getUTCFullYear() !== resetAt.getUTCFullYear() || now.getUTCMonth() !== resetAt.getUTCMonth();
    const comparesUsed = needsReset ? 0 : userRow.compares_used_this_month;
    if (needsReset) {
      await admin.from("users").update({ compares_used_this_month: 0, compares_reset_at: now.toISOString() }).eq("id", user.id);
    }

    if (comparesUsed >= COMPARE_MONTHLY_LIMIT) {
      return res.status(403).json({ error: "compare_limit_reached", remaining: 0, max: COMPARE_MONTHLY_LIMIT });
    }

    const prompt = buildComparePrompt(productA, productB, Number(priceA), Number(priceB), currency || "EGP");

    let geminiResult;
    try {
      geminiResult = await callGeminiWithFallback(prompt);
    } catch (e) {
      return res.status(502).json({ error: "comparison_failed" });
    }

    const parsed = geminiResult.data;
    if (!Array.isArray(parsed?.rows) || !parsed?.finalRecommendation) {
      return res.status(502).json({ error: "comparison_invalid" });
    }

    await logAiUsage(admin, {
      endpoint: "compare",
      model: geminiResult.modelUsed,
      tier: "premium",
      userId: user.id,
      usage: geminiResult.usage,
    });

    // ---- Record usage AFTER a successful comparison (never before) ----
    const newComparesUsed = comparesUsed + 1;
    await admin.from("users").update({ compares_used_this_month: newComparesUsed }).eq("id", user.id);

    const result = {
      productA,
      productB,
      priceA: Number(priceA),
      priceB: Number(priceB),
      currency: currency || "EGP",
      rows: parsed.rows,
      finalRecommendation: parsed.finalRecommendation,
      remaining: Math.max(0, COMPARE_MONTHLY_LIMIT - newComparesUsed),
      max: COMPARE_MONTHLY_LIMIT,
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error("[/api/compare] Unexpected error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
