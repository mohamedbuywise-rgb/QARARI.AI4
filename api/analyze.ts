import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, getAuthedUser } from "./_supabaseAdmin.js";
import { callGeminiWithFallback } from "./_gemini.js";
import { logAiUsage } from "./_costTracking.js";

const FREE_MONTHLY_LIMIT = 5;
const PREMIUM_MONTHLY_LIMIT = 50; // fair-use cap for paid subscribers, prevents runaway AI cost from outlier usage
const CACHE_TTL_HOURS = 72; // how long a cached market-research result stays valid for reuse

function normalizeCacheKey(product: string, currency: string): string {
  const normalizedProduct = product.trim().toLowerCase().replace(/\s+/g, " ");
  return `${normalizedProduct}::${currency.trim().toUpperCase()}`;
}

function buildPrompt(opts: {
  product: string;
  offeredPrice: number;
  currency: string;
  notes: string;
  purpose: string;
  duration: string;
  specs: string;
  language: "ar" | "en";
  tier: "free" | "premium";
}) {
  const { product, offeredPrice, currency, notes, purpose, duration, specs, tier } = opts;

  const depthInstruction =
    tier === "premium"
      ? `PREMIUM DEPTH REQUIRED:
- reasoningPoints: 3-4 fuller sentences each, with specific numbers (prices, percentages, timing).
- pros: 3-4 complete specific sentences (not short phrases).
- cons: 2-3 complete specific sentences (not short phrases).
- hiddenRisks: 3-4 specific, actionable items (seller verification, serial number checks, spec mismatches vs the stated usage profile).
- betterAlternatives: up to 6 items.
- Also include "negotiationScriptVariants": { "polite": {"ar":"...","en":"..."}, "firm": {"ar":"...","en":"..."} } IN ADDITION to negotiationScript.`
      : `FREE TIER DEPTH:
- reasoningPoints: 2-3 short numbered points.
- pros: 2-4 short bullet phrases.
- cons: 2-3 short bullet phrases.
- hiddenRisks: 1-2 short risk strings.
- betterAlternatives: 2-4 items.
- Do NOT include negotiationScriptVariants, only the single negotiationScript field.`;

  return `You are a purchase-decision analyst with real-time web search access. Research the CURRENT real market price for this product and produce a structured JSON analysis.

PRODUCT: ${product}
OFFERED PRICE: ${offeredPrice} ${currency}
USER NOTES: ${notes || "none"}
USAGE PROFILE — purpose: ${purpose}, expected duration: ${duration}, other specs/preferences: ${specs || "none"}

${depthInstruction}

Return a JSON object with EXACTLY this shape (all text fields must have both "ar" and "en" versions, natural fluent Arabic and English — not machine-translated):

{
  "verdict": "good" | "fair" | "bad",
  "marketFairPriceMin": number,
  "marketFairPriceMax": number,
  "marketFairPriceMid": number,
  "reasoningPoints": { "ar": string[], "en": string[] },
  "preRecommendation": { "ar": string, "en": string },
  "futureCompatibility": { "ar": string, "en": string },
  "regretLevel": "low" | "medium" | "high",
  "regretJustification": { "ar": string, "en": string },
  "pros": { "ar": string[], "en": string[] },
  "cons": { "ar": string[], "en": string[] },
  "hiddenRisks": { "ar": string[], "en": string[] },
  "finalTip": { "ar": string, "en": string },
  "betterAlternatives": [ { "name": string, "estimatedPrice": number, "reason": {"ar":string,"en":string}, "whySuitable": {"ar":string,"en":string} } ],
  "negotiationScript": { "ar": string, "en": string }${tier === "premium" ? ',\n  "negotiationScriptVariants": { "polite": {"ar":string,"en":string}, "firm": {"ar":string,"en":string} }' : ""}
}

Rules:
- marketFairPriceMin/Max must be a REAL researched range based on current market data you find via search, never a guess.
- marketFairPriceMid is the midpoint of min/max.
- verdict: "good" if offeredPrice < marketFairPriceMin, "fair" if within range, "bad" if above marketFairPriceMax.
- All prices in ${currency}.
- Return ONLY the JSON object, nothing else.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const {
      product,
      offeredPrice,
      currency,
      notes = "",
      purpose = "personal",
      duration = "threePlusYears",
      specs = "",
      language = "ar",
      imageBase64, // optional: { data, mimeType }
    } = req.body || {};

    if (!product || typeof product !== "string" || !offeredPrice || Number(offeredPrice) <= 0) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const admin = getSupabaseAdmin();
    const user = await getAuthedUser(req);

    let tier: "free" | "premium" = "free";
    let quotaOk = true;

    if (user) {
      // ---- SIGNED-IN USER: check/enforce quota tied to their account row ----
      const { data: userRow, error: userErr } = await admin
        .from("users")
        .select("tier, subscription_end_date, scans_used_this_month, scans_reset_at")
        .eq("id", user.id)
        .single();

      if (userErr || !userRow) {
        return res.status(404).json({ error: "user_not_found" });
      }

      // Auto-revert to Free if subscription expired (Section 16)
      const now = new Date();
      let effectiveTier = userRow.tier;
      if (effectiveTier === "premium" && userRow.subscription_end_date && new Date(userRow.subscription_end_date) < now) {
        effectiveTier = "free";
        await admin.from("users").update({ tier: "free" }).eq("id", user.id);
      }
      tier = effectiveTier as "free" | "premium";

      // Reset monthly counter if a new cycle has started
      const resetAt = new Date(userRow.scans_reset_at);
      const needsReset = now.getUTCFullYear() !== resetAt.getUTCFullYear() || now.getUTCMonth() !== resetAt.getUTCMonth();
      let scansUsed = needsReset ? 0 : userRow.scans_used_this_month;
      if (needsReset) {
        await admin.from("users").update({ scans_used_this_month: 0, scans_reset_at: now.toISOString() }).eq("id", user.id);
      }

      if (tier === "free" && scansUsed >= FREE_MONTHLY_LIMIT) {
        quotaOk = false;
      }
      if (tier === "premium" && scansUsed >= PREMIUM_MONTHLY_LIMIT) {
        quotaOk = false;
      }

      if (!quotaOk) {
        return res.status(403).json({ error: "quota_exceeded" });
      }
    } else {
      // ---- GUEST: track by IP address ----
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";

      const { data: guestRow } = await admin.from("guest_usage").select("*").eq("ip_address", ip).single();
      const now = new Date();

      let scansUsed = 0;
      if (guestRow) {
        const resetAt = new Date(guestRow.scans_reset_at);
        const needsReset = now.getUTCFullYear() !== resetAt.getUTCFullYear() || now.getUTCMonth() !== resetAt.getUTCMonth();
        scansUsed = needsReset ? 0 : guestRow.scans_used_this_month;
      }

      if (scansUsed >= FREE_MONTHLY_LIMIT) {
        return res.status(403).json({ error: "quota_exceeded" });
      }

      // Upsert guest usage row (incremented after a successful analysis, below)
      await admin.from("guest_usage").upsert({
        ip_address: ip,
        scans_used_this_month: scansUsed,
        scans_reset_at: guestRow ? guestRow.scans_reset_at : now.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    // ---- Cache check (Section 25 cost-saving layer) ----
    // Popular products get scanned repeatedly by different users. Reuse the
    // same market-research result (same product + currency) within the TTL
    // window instead of paying for a brand-new Gemini + Search Grounding call.
    const cacheKey = normalizeCacheKey(product, currency);
    const cacheCutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();

    const { data: cachedRow } = await admin
      .from("analysis_cache")
      .select("parsed, model_used, created_at")
      .eq("cache_key", cacheKey)
      .gte("created_at", cacheCutoff)
      .single();

    let parsed: any;
    let modelUsed: string;

    if (cachedRow) {
      // Cache hit — skip Gemini entirely, no token cost, no search cost.
      parsed = cachedRow.parsed;
      modelUsed = cachedRow.model_used;
    } else {
      // ---- Call Gemini (Section 6 + Section 14A tier branching + Section 2 fallback) ----
      const prompt = buildPrompt({ product, offeredPrice: Number(offeredPrice), currency, notes, purpose, duration, specs, language, tier });

      let geminiResult;
      try {
        geminiResult = await callGeminiWithFallback(prompt, imageBase64);
      } catch (e) {
        // Section 10: both models failed — clear translated error, not a silent failure
        return res.status(502).json({ error: "analysis_failed" });
      }

      parsed = geminiResult.data;
      modelUsed = geminiResult.modelUsed;

      // Section 25: log AI usage/cost for every real Gemini call, win or lose downstream.
      await logAiUsage(admin, {
        endpoint: "analyze",
        model: geminiResult.modelUsed,
        tier: user ? tier : "guest",
        userId: user?.id || null,
        usage: geminiResult.usage,
      });

      // Store for future requests — best-effort, never blocks the response
      await admin.from("analysis_cache").upsert({
        cache_key: cacheKey,
        parsed,
        model_used: modelUsed,
        created_at: new Date().toISOString(),
      });
    }

    // Basic shape validation before trusting the response
    if (
      typeof parsed?.verdict !== "string" ||
      typeof parsed?.marketFairPriceMin !== "number" ||
      typeof parsed?.marketFairPriceMax !== "number"
    ) {
      return res.status(502).json({ error: "analysis_invalid" });
    }

    const marketFairPriceMid =
      parsed.marketFairPriceMid ?? Math.round((parsed.marketFairPriceMin + parsed.marketFairPriceMax) / 2);
    const moneySaved = Math.max(0, marketFairPriceMid - Number(offeredPrice));

    // ---- Community insights (Section 27 — REAL social proof, never fabricated) ----
    // Log this user's real offered price as an anonymous event, then look at
    // how many real events exist for the same product+currency. We only ever
    // surface genuine counts/ranges pulled from this table — if there isn't
    // enough real data yet, communityInsights comes back null and the UI
    // hides the widget instead of inventing a number.
    let communityInsights: {
      analyzedCount: number;
      recentPrices: number[];
    } | null = null;

    try {
      await admin.from("product_price_events").insert({
        cache_key: cacheKey,
        offered_price: Number(offeredPrice),
        currency,
      });

      const { count } = await admin
        .from("product_price_events")
        .select("*", { count: "exact", head: true })
        .eq("cache_key", cacheKey);

      const MIN_REAL_EVENTS_TO_SHOW = 3; // don't show a "community" stat for just 1-2 real data points

      if (count && count >= MIN_REAL_EVENTS_TO_SHOW) {
        const { data: recentEvents } = await admin
          .from("product_price_events")
          .select("offered_price")
          .eq("cache_key", cacheKey)
          .order("created_at", { ascending: false })
          .limit(5);

        communityInsights = {
          analyzedCount: count,
          recentPrices: (recentEvents || []).map((e: any) => Number(e.offered_price)),
        };
      }
    } catch (e) {
      // Best-effort only — never blocks or fails the actual analysis response.
      console.error("[/api/analyze] community insights failed:", e);
    }

    const result = {
      id: crypto.randomUUID(),
      product,
      offeredPrice: Number(offeredPrice),
      currency,
      ...parsed,
      marketFairPriceMid,
      moneySaved,
      communityInsights,
      createdAt: Date.now(),
    };

    // ---- Record usage AFTER a successful analysis (never before) ----
    if (user) {
      const { data: row } = await admin.from("users").select("scans_used_this_month").eq("id", user.id).single();
      await admin.from("users").update({ scans_used_this_month: (row?.scans_used_this_month || 0) + 1 }).eq("id", user.id);
    } else {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
      const { data: row } = await admin.from("guest_usage").select("scans_used_this_month").eq("ip_address", ip).single();
      await admin.from("guest_usage").update({ scans_used_this_month: (row?.scans_used_this_month || 0) + 1 }).eq("ip_address", ip);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[/api/analyze] Unexpected error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
