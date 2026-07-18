import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, getAuthedUser } from "./_supabaseAdmin.js";
import { callGeminiWithFallback } from "./_gemini.js";
import { logAiUsage } from "./_costTracking.js";

// Hard cap on how many chat questions can be asked per analysis. Each
// question is a Gemini call WITHOUT Search Grounding (unlike the main
// analysis) — plain reasoning over the existing report context only —
// so the per-message cost is low enough to allow a much higher cap.
const MAX_CHAT_MESSAGES_PER_REPORT = 20;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function buildChatPrompt(opts: {
  product: string;
  offeredPrice: number;
  currency: string;
  verdict: string;
  marketFairPriceMin: number;
  marketFairPriceMax: number;
  history: ChatTurn[];
  question: string;
  language: "ar" | "en";
}) {
  const { product, offeredPrice, currency, verdict, marketFairPriceMin, marketFairPriceMax, history, question, language } = opts;

  // Cost-saving: send only the base product context + the single last
  // assistant reply, not the full conversation history. The model doesn't
  // need every prior turn to answer a short follow-up — just the last thing
  // it said (for continuity) plus the fixed analysis context above.
  const lastAssistantTurn = [...history].reverse().find((m) => m.role === "assistant");
  const historyBlock = lastAssistantTurn ? `Assistant: ${lastAssistantTurn.content}` : "";

  const languageInstruction = language === "ar" ? "Answer in natural, fluent Arabic (Egyptian-friendly)." : "Answer in natural, fluent English.";

  return `You are a helpful purchase-decision assistant answering a short follow-up question about an analysis the user already received. Base your answer on the analysis context and conversation below only — you do not have live web/search access for this chat, so don't claim to look anything up; answer from the given facts and general knowledge.

ANALYSIS CONTEXT:
- Product: ${product}
- Offered price: ${offeredPrice} ${currency}
- Verdict: ${verdict}
- Fair market range: ${marketFairPriceMin}-${marketFairPriceMax} ${currency}

${historyBlock ? `LAST REPLY:\n${historyBlock}\n` : ""}
NEW QUESTION: ${question}

${languageInstruction} Keep the answer short and conversational — 2-4 sentences, no headers or markdown.

Return a JSON object with EXACTLY this shape and nothing else:
{ "answer": string }`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const {
      reportId,
      product,
      offeredPrice,
      currency,
      verdict,
      marketFairPriceMin,
      marketFairPriceMax,
      question,
      history = [],
      language = "ar",
    } = req.body || {};

    if (!reportId || typeof reportId !== "string" || !question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "invalid_input" });
    }
    if (!product || typeof product !== "string" || typeof offeredPrice !== "number") {
      return res.status(400).json({ error: "invalid_input" });
    }

    const admin = getSupabaseAdmin();
    const user = await getAuthedUser(req);

    // Identity used for the per-report chat cap — same signed-in vs guest
    // split used elsewhere (Section 14), so the same person can't dodge the
    // cap by logging out mid-conversation and back in.
    const identity = user
      ? `user:${user.id}`
      : `ip:${(req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown"}`;

    const { data: usageRow } = await admin
      .from("chat_usage")
      .select("messages_used")
      .eq("report_id", reportId)
      .eq("identity", identity)
      .single();

    const used = usageRow?.messages_used || 0;

    // Real tier — also determines whether the per-report chat cap applies.
    // Premium subscribers get unlimited chat (advertised on the subscription
    // screen); Free/guest users stay capped for cost control.
    let tier: "free" | "premium" | "guest" = "guest";
    if (user) {
      const { data: userRow } = await admin
        .from("users")
        .select("tier, subscription_end_date")
        .eq("id", user.id)
        .single();
      let effectiveTier = userRow?.tier || "free";
      if (effectiveTier === "premium" && userRow?.subscription_end_date && new Date(userRow.subscription_end_date) < new Date()) {
        effectiveTier = "free";
        await admin.from("users").update({ tier: "free" }).eq("id", user.id);
      }
      tier = effectiveTier as "free" | "premium";
    }

    const isUnlimitedChat = tier === "premium";
    if (!isUnlimitedChat && used >= MAX_CHAT_MESSAGES_PER_REPORT) {
      return res.status(403).json({ error: "chat_limit_reached", remaining: 0, max: MAX_CHAT_MESSAGES_PER_REPORT });
    }

    const prompt = buildChatPrompt({
      product,
      offeredPrice: Number(offeredPrice),
      currency: currency || "EGP",
      verdict: verdict || "fair",
      marketFairPriceMin: Number(marketFairPriceMin) || 0,
      marketFairPriceMax: Number(marketFairPriceMax) || 0,
      history: Array.isArray(history) ? history : [],
      question: question.trim(),
      language: language === "en" ? "en" : "ar",
    });

    let geminiResult;
    try {
      geminiResult = await callGeminiWithFallback(prompt, undefined, false);
    } catch (e) {
      return res.status(502).json({ error: "ask_failed" });
    }

    const answer = geminiResult.data?.answer;
    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({ error: "ask_invalid" });
    }

    // Section 25: log every real Gemini call, same as /api/analyze and /api/compare.
    await logAiUsage(admin, {
      endpoint: "ask",
      model: geminiResult.modelUsed,
      tier,
      userId: user?.id || null,
      usage: geminiResult.usage,
    });

    // ---- Record usage AFTER a successful answer (never before) ----
    const newUsed = used + 1;
    await admin.from("chat_usage").upsert({
      report_id: reportId,
      identity,
      messages_used: newUsed,
      updated_at: new Date().toISOString(),
    });

    return res.status(200).json({
      answer: answer.trim(),
      remaining: isUnlimitedChat ? null : Math.max(0, MAX_CHAT_MESSAGES_PER_REPORT - newUsed),
      max: isUnlimitedChat ? null : MAX_CHAT_MESSAGES_PER_REPORT,
      unlimited: isUnlimitedChat,
    });
  } catch (err) {
    console.error("[/api/ask] Unexpected error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
