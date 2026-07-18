import type { GeminiUsage } from "./_gemini.js";

// ---- ESTIMATED pricing table (USD per 1M tokens) ----
// These are configured placeholders — update to match Gemini's current
// published pricing at ai.google.dev/pricing. They exist so the AI Cost
// Dashboard (Section 25) can show a directional cost estimate, not an
// invoice-accurate figure (actual billing always comes from Google Cloud).
// NOTE: keys must match PRIMARY_MODEL / FALLBACK_MODEL in _gemini.ts exactly —
// a mismatch here silently falls back to DEFAULT_PRICING and understates cost.
const MODEL_PRICING_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
};
const DEFAULT_PRICING = { input: 0.5, output: 1.5 };

// Real per-query grounding price (Gemini 3.x models, incl. Flash-Lite): Google
// charges per individual search query the model actually executes — not a
// flat per-call fee. $14 per 1,000 queries = $0.014/query. Source:
// ai.google.dev/gemini-api/docs/pricing (verified 2026-07-14).
// NOTE: Gemini 3.x also gives 5,000 free grounded queries/month shared across
// the whole project — this constant doesn't account for that free pool, so
// low-volume months will show a slightly higher estimate than the real bill.
const GROUNDING_COST_USD_PER_QUERY = 0.014;

export function estimateCostUsd(model: string, usage: GeminiUsage): number {
  const pricing = MODEL_PRICING_PER_1M_TOKENS[model];
  if (!pricing) {
    // Surface this loudly instead of silently understating cost — if a model
    // name changes in _gemini.ts without updating this table, the Dashboard
    // would otherwise report artificially low numbers with no visible sign.
    console.error(`[costTracking] No pricing entry for model "${model}" — falling back to DEFAULT_PRICING. Update MODEL_PRICING_PER_1M_TOKENS.`);
  }
  const resolvedPricing = pricing || DEFAULT_PRICING;
  const inputCost = (usage.promptTokens / 1_000_000) * resolvedPricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * resolvedPricing.output;
  const groundingCost = (usage.searchQueryCount || 0) * GROUNDING_COST_USD_PER_QUERY;
  return Number((inputCost + outputCost + groundingCost).toFixed(6));
}

// Fire-and-forget-safe logger (still awaited by callers so it completes
// before the serverless function returns, but never throws upward).
export async function logAiUsage(
  admin: any,
  opts: {
    endpoint: string;
    model: string;
    tier: "free" | "premium" | "guest";
    userId?: string | null;
    usage: GeminiUsage;
  }
) {
  try {
    const costUsd = estimateCostUsd(opts.model, opts.usage);
    await admin.from("ai_usage_log").insert({
      endpoint: opts.endpoint,
      model: opts.model,
      tier: opts.tier,
      user_id: opts.userId || null,
      prompt_tokens: opts.usage.promptTokens,
      output_tokens: opts.usage.outputTokens,
      total_tokens: opts.usage.totalTokens,
      search_query_count: opts.usage.searchQueryCount || 0,
      estimated_cost_usd: costUsd,
    });
  } catch (e) {
    console.error("[costTracking] Failed to log AI usage:", e);
  }
}
