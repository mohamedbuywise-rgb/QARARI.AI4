import { useState, useMemo, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { currencies } from "@/lib/types";
import type { Verdict } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Info, TrendingUp, AlertTriangle, Check, X, Compass,
  Shield, Lightbulb, Copy, Share2, Bookmark, Bell,
  ThumbsUp, ThumbsDown, MessageCircle, Mic, Send,
  Sparkles, GitCompare, Crown, Users,
} from "lucide-react";

export function ReportScreen() {
  const { t, lang, dir, currentReport, navigate, saveToHistory, history, user, session, showToast, isPremium, requireAuth } = useApp();
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);
  const [showFeedbackBox, setShowFeedbackBox] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatRemaining, setChatRemaining] = useState(20);
  const [chatLimitHit, setChatLimitHit] = useState(false);
  const [listening, setListening] = useState(false);
  const [negVariant, setNegVariant] = useState<"polite" | "firm">("polite");
  const [showCompareInput, setShowCompareInput] = useState(false);
  const [compareProduct, setCompareProduct] = useState("");
  const recognitionRef = useRef<any>(null);

  const report = currentReport;
  if (!report) {
    navigate("input");
    return null;
  }

  const isExample = report.id.startsWith("demo-");
  const isSaved = history.some((h) => h.id === report.id);

  const currencyShort = (code: string) => {
    const c = currencies.find((c) => c.code === code);
    return lang === "ar" ? c?.arShort : c?.enShort;
  };
  const cShort = currencyShort(report.currency);

  const verdictConfig: Record<Verdict, { color: string; bg: string; border: string }> = {
    good: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
    fair: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
    bad: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  };
  const vc = verdictConfig[report.verdict];

  const ProductIcon = useMemo(() => getCategoryIcon(report.product), [report.product]);

  const handleSave = () => {
    requireAuth(async () => {
      await saveToHistory(report);
      showToast(t("saveToHistory") + " ✓");
    });
  };

  const handleShare = async () => {
    const summary = `${t("appName")} — ${report.product}\n${t(report.verdict === "good" ? "goodDeal" : report.verdict === "fair" ? "fairDeal" : "badDeal")}\n${t("offeredPrice")}: ${report.offeredPrice.toLocaleString()} ${cShort}\n${t("fairPriceRange")}: ${report.marketFairPriceMin.toLocaleString()}-${report.marketFairPriceMax.toLocaleString()} ${cShort}\n${t("potentialSavings")}: ${report.moneySaved.toLocaleString()} ${cShort}`;
    if (navigator.share) {
      try { await navigator.share({ text: summary, title: t("appName") }); } catch {}
    } else {
      navigator.clipboard.writeText(summary);
      showToast(t("copied"));
    }
  };

  const handleCopyNegotiation = () => {
    const text = lang === "ar" ? report.negotiationScript.ar : report.negotiationScript.en;
    navigator.clipboard.writeText(text);
    showToast(t("copied"));
  };

  const handleWhatsAppShare = () => {
    const text = lang === "ar" ? report.negotiationScript.ar : report.negotiationScript.en;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleFeedback = (type: "up" | "down") => {
    if (type === "up") { setFeedbackGiven("up"); showToast(t("thanksFeedback")); }
    else { setFeedbackGiven("down"); setShowFeedbackBox(true); }
  };

  const submitFeedback = () => {
    setFeedbackGiven("down"); setShowFeedbackBox(false); showToast(t("thanksFeedback"));
  };

  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { showToast(lang === "ar" ? "المتصفح لا يدعم الإدخال الصوتي" : "Browser doesn't support voice input"); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = lang === "ar" ? "ar-EG" : "en-US";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setChatInput((prev) => (prev ? prev + " " : "") + transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    // Demo/example reports never hit the real API — no product to actually
    // research and no point spending a Gemini call on it.
    if (isExample) {
      setChatMessages((prev) => [...prev, { role: "user", content: chatInput }, { role: "assistant", content: t("chatDisabledExample") }]);
      setChatInput("");
      return;
    }

    if (!isPremium && (chatLimitHit || chatRemaining <= 0)) {
      setChatLimitHit(true);
      return;
    }

    const question = chatInput.trim();
    const outgoingHistory = [...chatMessages, { role: "user" as const, content: question }];
    setChatMessages(outgoingHistory);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          reportId: report.id,
          product: report.product,
          offeredPrice: report.offeredPrice,
          currency: report.currency,
          verdict: report.verdict,
          marketFairPriceMin: report.marketFairPriceMin,
          marketFairPriceMax: report.marketFairPriceMax,
          question,
          history: chatMessages.slice(-8),
          language: lang,
        }),
      });

      if (res.status === 403) {
        if (!isPremium) {
          setChatLimitHit(true);
          setChatRemaining(0);
        }
        setChatMessages((prev) => [...prev, { role: "assistant", content: t("chatLimitReached") }]);
        return;
      }

      if (!res.ok) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: t("chatError") }]);
        return;
      }

      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      if (!data.unlimited && typeof data.remaining === "number") {
        setChatRemaining(data.remaining);
        if (data.remaining <= 0) setChatLimitHit(true);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: t("chatError") }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCompare = () => {
    if (!isPremium) {
      navigate("upgrade");
      return;
    }
    if (!compareProduct.trim()) return;
    // Hand off product B to CompareScreen, which pre-fills product A / price A
    // from currentReport and picks this up on mount.
    sessionStorage.setItem("qarari-compare-prefill-b", compareProduct.trim());
    setShowCompareInput(false);
    setCompareProduct("");
    navigate("compare");
  };

  const bilingual = (bt: { ar: string; en: string }) => (lang === "ar" ? bt.ar : bt.en);
  const bilingualArr = (ba: { ar: string[]; en: string[] }) => (lang === "ar" ? ba.ar : ba.en);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      {isExample && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-400">
          <Sparkles className="h-4 w-4" /> {t("example")}
        </div>
      )}

      {/* Product Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black shadow-lg ring-1 ring-amber-500/20">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent" />
          <ProductIcon className="relative h-10 w-10 text-amber-400/90" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-2xl font-bold text-amber-400">{report.product}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-zinc-800/60 px-2.5 py-1 text-sm text-zinc-300">
              {report.offeredPrice.toLocaleString()} {cShort}
            </span>
            <span className={`rounded-lg ${vc.bg} ${vc.border} border px-2.5 py-1 text-sm font-medium ${vc.color}`}>
              {t(report.verdict === "good" ? "goodDeal" : report.verdict === "fair" ? "fairDeal" : "badDeal")}
            </span>
            {report.moneySaved > 0 && (
              <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-sm font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                {t("moneySaved")}: {report.moneySaved.toLocaleString()} {cShort}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Market Overview */}
      <div className="mb-4 rounded-xl border border-amber-500/15 bg-zinc-900/60 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-amber-400">
          <Search className="h-5 w-5" /> {t("marketOverview")}
        </h2>
        <div className="flex items-center justify-between rounded-xl bg-zinc-800/40 p-4">
          <div className="text-center">
            <p className="text-xs text-zinc-500">{t("offeredPrice")}</p>
            <p className="mt-1 text-lg font-bold text-zinc-100">{report.offeredPrice.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">{cShort}</p>
          </div>
          <div className="h-12 w-px bg-zinc-700" />
          <div className="text-center">
            <p className="text-xs text-zinc-500">{t("fairPriceRange")}</p>
            <p className="mt-1 text-lg font-bold text-amber-400">
              {report.marketFairPriceMin.toLocaleString()}–{report.marketFairPriceMax.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500">{cShort}</p>
          </div>
        </div>
      </div>

      {/* Community Radar — only renders with REAL data (never a fabricated count) */}
      {report.communityInsights && report.communityInsights.analyzedCount >= 3 && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-emerald-400">
            <Users className="h-5 w-5" /> {t("communityInsightsTitle")}
          </h2>
          <p className="text-sm text-zinc-300">
            <span className="font-bold text-emerald-400">{report.communityInsights.analyzedCount.toLocaleString()}</span>{" "}
            {t("communityAnalyzedCount")}
          </p>
          {report.communityInsights.recentPrices.length > 1 && (
            <div className="mt-3 border-t border-emerald-500/15 pt-3">
              <p className="mb-2 text-xs text-zinc-500">{t("communityRecentPrices")}</p>
              <div className="flex flex-wrap gap-2">
                {report.communityInsights.recentPrices.map((p, i) => (
                  <span key={i} className="rounded-lg bg-zinc-800/60 px-2.5 py-1 text-sm text-zinc-200">
                    {p.toLocaleString()} {cShort}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Final Verdict */}
      <div className="mb-4 rounded-xl border border-amber-500/15 bg-zinc-900/60 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-amber-400">
          <Info className="h-5 w-5" /> {t("finalVerdict")}
        </h2>
        <ol className={`space-y-2 ${dir === "rtl" ? "pr-5" : "pl-5"}`}>
          {bilingualArr(report.reasoningPoints).map((point, i) => (
            <li key={i} className="text-sm text-zinc-300">
              <span className="font-bold text-amber-400">{i + 1}.</span> {point}
            </li>
          ))}
        </ol>
        {isPremium && (
          <p className="mt-3 flex items-center gap-1 text-xs text-zinc-500">
            <Sparkles className="h-3 w-3" /> {t("expandedAnalysis")}
          </p>
        )}
      </div>

      {/* Before You Buy */}
      <div className={`mb-4 rounded-xl border ${report.verdict === "bad" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"} p-4`}>
        <div className="flex items-start gap-2">
          <AlertTriangle className={`h-5 w-5 shrink-0 ${report.verdict === "bad" ? "text-red-400" : "text-amber-400"}`} />
          <div>
            <p className={`text-sm font-bold ${report.verdict === "bad" ? "text-red-400" : "text-amber-400"}`}>{t("beforeYouBuy")}</p>
            <p className="mt-1 text-sm text-zinc-300">{bilingual(report.preRecommendation)}</p>
          </div>
        </div>
      </div>

      {/* Future + Regret */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-500/15 bg-zinc-900/60 p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-400">
            <TrendingUp className="h-4 w-4" /> {t("futureCompatibility")}
          </h3>
          <p className="text-sm text-zinc-300">{bilingual(report.futureCompatibility)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/15 bg-zinc-900/60 p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-400">
            <AlertTriangle className="h-4 w-4" /> {t("regretProbability")}
          </h3>
          <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${
            report.regretLevel === "low" ? "bg-emerald-500/10 text-emerald-400" :
            report.regretLevel === "medium" ? "bg-amber-500/10 text-amber-400" :
            "bg-red-500/10 text-red-400"
          }`}>
            {t(report.regretLevel)}
          </span>
          <p className="mt-2 text-sm text-zinc-300">{bilingual(report.regretJustification)}</p>
        </div>
      </div>

      {/* Cons + Pros */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {dir === "rtl" ? (
          <>
            <div className="rounded-xl border border-red-500/15 bg-zinc-900/60 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-400">
                <X className="h-4 w-4" /> {t("cons")}
              </h3>
              <ul className="space-y-2">
                {bilingualArr(report.cons).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <X className="h-4 w-4 shrink-0 text-red-400" /> {item}
                  </li>
                ))}
              </ul>
              {isPremium && <p className="mt-3 flex items-center gap-1 text-xs text-zinc-500"><Sparkles className="h-3 w-3" /> {t("expandedAnalysis")}</p>}
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-zinc-900/60 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-400">
                <Check className="h-4 w-4" /> {t("pros")}
              </h3>
              <ul className="space-y-2">
                {bilingualArr(report.pros).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {item}
                  </li>
                ))}
              </ul>
              {isPremium && <p className="mt-3 flex items-center gap-1 text-xs text-zinc-500"><Sparkles className="h-3 w-3" /> {t("expandedAnalysis")}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-500/15 bg-zinc-900/60 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-400">
                <Check className="h-4 w-4" /> {t("pros")}
              </h3>
              <ul className="space-y-2">
                {bilingualArr(report.pros).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {item}
                  </li>
                ))}
              </ul>
              {isPremium && <p className="mt-3 flex items-center gap-1 text-xs text-zinc-500"><Sparkles className="h-3 w-3" /> {t("expandedAnalysis")}</p>}
            </div>
            <div className="rounded-xl border border-red-500/15 bg-zinc-900/60 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-400">
                <X className="h-4 w-4" /> {t("cons")}
              </h3>
              <ul className="space-y-2">
                {bilingualArr(report.cons).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <X className="h-4 w-4 shrink-0 text-red-400" /> {item}
                  </li>
                ))}
              </ul>
              {isPremium && <p className="mt-3 flex items-center gap-1 text-xs text-zinc-500"><Sparkles className="h-3 w-3" /> {t("expandedAnalysis")}</p>}
            </div>
          </>
        )}
      </div>

      {/* Better Alternatives + Compare Button */}
      <div className="mb-4">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-amber-400">
          <Compass className="h-5 w-5" /> {t("betterAlternatives")}
        </h2>
        <div className="space-y-3">
          {report.betterAlternatives.map((alt, i) => {
            const AltIcon = getCategoryIcon(alt.name);
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-zinc-900/60 p-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black shadow-md ring-1 ring-amber-500/20">
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent" />
                  <AltIcon className="relative h-7 w-7 text-amber-400/90" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold text-zinc-100">{alt.name}</h3>
                    <span className="shrink-0 rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400">
                      {alt.estimatedPrice.toLocaleString()} {cShort}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{bilingual(alt.reason)}</p>
                  <p className="mt-1 text-xs text-zinc-500">{bilingual(alt.whySuitable)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Compare with another product */}
        <div className="mt-3">
          {!showCompareInput ? (
            <Button
              onClick={() => setShowCompareInput(true)}
              variant="outline"
              className="w-full border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10"
            >
              <GitCompare className="h-4 w-4" /> {lang === "ar" ? "قارن بمنتج آخر" : "Compare with another product"}
              {!isPremium && <Crown className="ml-1 h-3 w-3" />}
            </Button>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-zinc-900/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-400">
                <GitCompare className="h-4 w-4" /> {lang === "ar" ? "قارن بمنتج آخر" : "Compare with another product"}
              </h3>
              <div className="flex gap-2">
                <Input
                  value={compareProduct}
                  onChange={(e) => setCompareProduct(e.target.value)}
                  placeholder={t("productNamePlaceholder")}
                  className="flex-1 border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50"
                />
                <Button onClick={handleCompare} className="bg-amber-500 text-[#0B0B0F] hover:bg-amber-400">
                  <GitCompare className="h-4 w-4" /> {t("compareNow")}
                </Button>
              </div>
              <button onClick={() => setShowCompareInput(false)} className="mt-2 text-xs text-zinc-500 hover:text-zinc-300">
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Negotiation Script */}
      <div className="mb-4 rounded-xl border border-amber-500/15 bg-zinc-900/60 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-amber-400">
          <MessageCircle className="h-5 w-5" /> {t("negotiationScript")}
        </h2>
        {isPremium && (
          <div className="mb-3 flex gap-2">
            {(["polite", "firm"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setNegVariant(v)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  negVariant === v ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "bg-zinc-800/50 text-zinc-400"
                }`}
              >
                {t(v)}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-xl bg-zinc-800/40 p-4">
          <p className="text-sm leading-relaxed text-zinc-200">{bilingual(report.negotiationScript)}</p>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={handleCopyNegotiation} variant="outline" className="flex-1 border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-amber-400">
            <Copy className="h-4 w-4" /> {t("copy")}
          </Button>
          <Button onClick={handleWhatsAppShare} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500">
            <Share2 className="h-4 w-4" /> {t("shareWhatsApp")}
          </Button>
        </div>
      </div>

      {/* Hidden Risks */}
      <div className="mb-4 rounded-xl border border-amber-500/15 bg-zinc-900/60 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-amber-400">
          <Shield className="h-5 w-5" /> {t("hiddenRisks")}
        </h2>
        <ul className="space-y-2">
          {bilingualArr(report.hiddenRisks).map((risk, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              {risk}
            </li>
          ))}
        </ul>
        {isPremium && (
          <p className="mt-3 flex items-center gap-1 text-xs text-zinc-500">
            <Sparkles className="h-3 w-3" /> {t("expandedAnalysis")}
          </p>
        )}
      </div>

      {/* Final Tip */}
      <div className="mb-4 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-6 text-center shadow-lg shadow-amber-500/5">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <Lightbulb className="h-6 w-6 text-amber-400" />
        </div>
        <p className="font-serif text-base leading-relaxed text-amber-100">{bilingual(report.finalTip)}</p>
      </div>

      {/* Feedback */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
        <p className="mb-3 text-sm text-zinc-400">{t("feedbackQuestion")}</p>
        {feedbackGiven ? (
          <p className="text-sm font-medium text-amber-400">{t("thanksFeedback")}</p>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => handleFeedback("up")} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-emerald-500/15 hover:text-emerald-400">
              <ThumbsUp className="h-5 w-5" />
            </button>
            <button onClick={() => handleFeedback("down")} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-red-500/15 hover:text-red-400">
              <ThumbsDown className="h-5 w-5" />
            </button>
          </div>
        )}
        {showFeedbackBox && !feedbackGiven && (
          <div className="mt-3 space-y-2">
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={t("tellUsWhy")}
              className="min-h-[60px] w-full rounded-lg border border-zinc-700 bg-zinc-800/50 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <Button onClick={submitFeedback} className="w-full bg-amber-500 text-[#0B0B0F] hover:bg-amber-400">
              {t("submitFeedback")}
            </Button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={handleSave} disabled={isSaved} className="bg-amber-500 text-[#0B0B0F] hover:bg-amber-400 disabled:opacity-50">
          <Bookmark className="h-4 w-4" /> {isSaved ? "✓ " + t("saveToHistory") : t("saveToHistory")}
        </Button>
        <Button onClick={handleShare} variant="outline" className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-amber-400">
          <Share2 className="h-4 w-4" /> {t("shareReport")}
        </Button>
        <Button onClick={() => navigate("input")} variant="outline" className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-amber-400">
          <Sparkles className="h-4 w-4" /> {t("newDecision")}
        </Button>
        <Button
          onClick={() => {
            requireAuth(async () => {
              await supabase.from("watchlist").insert({
                user_id: (await supabase.auth.getUser()).data.user?.id,
                product: report.product,
                saved_price: report.offeredPrice,
                currency: report.currency,
              });
              showToast(t("notifyPriceDrop") + " ✓");
            });
          }}
          variant="outline"
          className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-amber-400"
        >
          <Bell className="h-4 w-4" /> {t("notifyPriceDrop")}
        </Button>
      </div>

      {/* Floating Chat Bubble */}
      <button
        onClick={() => setShowChat(!showChat)}
        className={`fixed bottom-6 ${dir === "rtl" ? "left-4" : "right-4"} z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[#0B0B0F] shadow-xl shadow-amber-500/30 transition-transform hover:scale-105`}
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {/* Chat Panel */}
      {showChat && (
        <div className={`fixed bottom-20 ${dir === "rtl" ? "left-4" : "right-4"} z-50 flex h-80 w-80 flex-col overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0B0B0F] shadow-2xl`}>
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-bold text-amber-400">
              <MessageCircle className="h-4 w-4" /> {t("askAssistant")}
            </span>
            <div className="flex items-center gap-2">
              {!isExample && (
                <span className="text-[10px] text-zinc-500">
                  {isPremium ? t("chatUnlimitedBadge") : t("chatQuestionsLeft").replace("{n}", String(chatRemaining))}
                </span>
              )}
              <button onClick={() => setShowChat(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-zinc-500 mt-8">{t("askAssistantHint")}</p>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === "user" ? "bg-amber-500/20 text-amber-100" : "bg-zinc-800 text-zinc-300"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400">{t("chatThinking")}</div>
              </div>
            )}
          </div>
          <div className="border-t border-zinc-800 bg-zinc-900/50 p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder={t("typeMessage")}
                disabled={chatLoading || (chatLimitHit && !isExample)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={toggleListening}
                disabled={chatLoading || (chatLimitHit && !isExample)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                  listening ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-zinc-800 text-amber-400 hover:bg-amber-500/15"
                }`}
                title={t("voiceInput")}
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                onClick={sendChat}
                disabled={chatLoading || (chatLimitHit && !isExample)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-[#0B0B0F] hover:bg-amber-400 disabled:opacity-50"
                title={t("send")}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}