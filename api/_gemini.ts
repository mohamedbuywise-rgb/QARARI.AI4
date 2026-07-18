// Shared Gemini calling logic: primary model → fallback model (Section 2),
// with search grounding enabled and strict JSON-only output enforcement.

// 2026-07-19 update: gemini-2.5-flash-lite started returning 404 ("no longer
// available to new users") — Google is retiring the entire 2.5 family, and
// it's unsafe to depend on it as a fallback going forward.
// gemini-3.5-flash is the new FALLBACK — it's Stable/GA with no announced
// shutdown date (unlike preview models, which is exactly what caused this
// kind of breakage before). It costs more per token than the primary
// ($1.50/$9 per 1M vs $0.25/$1.50), but since it only fires when the primary
// fails, that cost barely moves the total bill — reliability matters more
// here than shaving a fraction of a cent off a rare fallback call.
const PRIMARY_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODEL = "gemini-3.5-flash";

interface GeminiCallResult {
  text: string;
  modelUsed: string;
}

export interface GeminiUsage {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  searchQueryCount: number; // real billable search-query count from groundingMetadata.webSearchQueries, not a guess
}

async function callGeminiModel(model: string, prompt: string, imageBase64?: { data: string; mimeType: string }, useSearch: boolean = true): Promise<{ text: string; usage: GeminiUsage }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY env var");

  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    parts.push({
      inline_data: { mime_type: imageBase64.mimeType, data: imageBase64.data },
    });
  }

  const body = {
    contents: [{ role: "user", parts }],
    ...(useSearch ? { tools: [{ google_search: {} }] } : {}), // search grounding — real market research, no separate search API. Disabled for chat (Section: ask) to keep per-message cost down.
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  };

  // 2026-07-19 fix: send the key via the x-goog-api-key HEADER, not the
  // ?key= query parameter. Google has started issuing a new "Auth key"
  // format (prefixed AQ. instead of the old AIza...) as part of migrating
  // everyone off "Standard keys" — and Auth keys aren't reliably accepted
  // via the old query-string method. The header works for both old and new
  // key formats, so this is safe regardless of which type of key is set.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${model} error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini ${model} returned no text content`);

  // Real billable search-query count, straight from Google's own response —
  // this replaces the flat $0.02-per-call guess that used to live in
  // _costTracking.ts. Each entry in webSearchQueries is one billed query.
  const searchQueryCount: number = Array.isArray(json?.candidates?.[0]?.groundingMetadata?.webSearchQueries)
    ? json.candidates[0].groundingMetadata.webSearchQueries.length
    : 0;

  const usage: GeminiUsage = {
    promptTokens: json?.usageMetadata?.promptTokenCount || 0,
    outputTokens: json?.usageMetadata?.candidatesTokenCount || 0,
    totalTokens: json?.usageMetadata?.totalTokenCount || 0,
    searchQueryCount,
  };

  return { text, usage };
}

function tryParseJson(text: string): any {
  // Strip markdown code fences if the model added them despite instructions
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(" 429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
}

// 2026-07-18 update: cut down to a MAX OF 2 real Gemini calls per user action
// (was up to 3). The old flow did primary → primary-strict-retry → fallback,
// which meant one analysis could burn 3 requests against the same rate-limit
// window. Since primary and fallback are now genuinely different models with
// separate quota buckets, there's no benefit to retrying the same model twice
// before falling back — we go straight to fallback on any primary failure.
export async function callGeminiWithFallback(prompt: string, imageBase64?: { data: string; mimeType: string }, useSearch: boolean = true): Promise<{ data: any; modelUsed: string; usage: GeminiUsage; usedSearch: boolean }> {
  const strictSuffix = "\n\nCRITICAL: Return ONLY valid JSON. No markdown formatting, no code fences, no explanatory text before or after the JSON object.";

  // 1. Try primary model (cheapest — gemini-2.5-flash-lite)
  try {
    const { text, usage } = await callGeminiModel(PRIMARY_MODEL, prompt, imageBase64, useSearch);
    return { data: tryParseJson(text), modelUsed: PRIMARY_MODEL, usage, usedSearch: useSearch };
  } catch (e1) {
    console.error(`[Gemini] Primary model (${PRIMARY_MODEL}) failed:`, e1);
    if (isQuotaError(e1)) {
      console.error(`[Gemini] Primary hit its rate limit — going straight to fallback's separate quota.`);
    }
  }

  // 2. Fall back to a genuinely different model (own quota bucket), silently
  // — never surfaced to the user. This is the only retry; total calls per
  // user action are capped at 2.
  try {
    const { text, usage } = await callGeminiModel(FALLBACK_MODEL, prompt + strictSuffix, imageBase64, useSearch);
    return { data: tryParseJson(text), modelUsed: FALLBACK_MODEL, usage, usedSearch: useSearch };
  } catch (e2) {
    console.error(`[Gemini] Fallback model (${FALLBACK_MODEL}) also failed:`, e2);
    throw new Error("gemini_unavailable");
  }
}
