import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { currencies } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GitCompare, ChevronLeft, Crown, Check, Sparkles } from "lucide-react";

export function CompareScreen() {
  const { t, lang, dir, navigate, currentCompare, setCurrentCompare, isPremium, currentReport, showToast, session } = useApp();
  const [productA, setProductA] = useState(currentReport?.product || "");
  const [productB, setProductB] = useState("");
  const [priceA, setPriceA] = useState(currentReport ? String(currentReport.offeredPrice) : "");
  const [priceB, setPriceB] = useState("");
  const [currency, setCurrency] = useState(currentReport?.currency || "EGP");
  const [loading, setLoading] = useState(false);

  // Pick up a product-B handoff left by ReportScreen's inline "compare with
  // another product" box, if the person arrived here that way.
  useEffect(() => {
    const prefill = sessionStorage.getItem("qarari-compare-prefill-b");
    if (prefill) {
      setProductB(prefill);
      sessionStorage.removeItem("qarari-compare-prefill-b");
    }
  }, []);

  if (!isPremium) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-xl">
          <Crown className="h-8 w-8 text-[#0B0B0F]" />
        </div>
        <h2 className="font-serif text-xl font-bold text-amber-400">{t("premium")}</h2>
        <p className="mt-2 text-sm text-zinc-400">{t("upgradeDesc")}</p>
        <Button onClick={() => navigate("upgrade")} className="mt-6 bg-gradient-to-r from-amber-400 to-amber-600 text-[#0B0B0F] font-bold hover:from-amber-300 hover:to-amber-500">
          <Crown className="h-4 w-4" /> {t("subscribeNow")}
        </Button>
        <button onClick={() => navigate("input")} className="mt-4 text-sm text-zinc-500 hover:text-amber-400">
          {t("back")}
        </button>
      </div>
    );
  }

  const handleCompare = async () => {
    if (!productA.trim() || !productB.trim() || !priceA || !priceB) {
      showToast(lang === "ar" ? "اكتب اسم المنتجين والسعرين" : "Enter both products and prices");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          productA: productA.trim(),
          productB: productB.trim(),
          priceA: parseFloat(priceA),
          priceB: parseFloat(priceB),
          currency,
        }),
      });

      if (res.status === 401) {
        navigate("upgrade");
        return;
      }
      if (res.status === 403) {
        const errBody = await res.json().catch(() => ({}));
        if (errBody?.error === "compare_limit_reached") {
          showToast(t("compareLimitReached"));
        } else {
          navigate("upgrade");
        }
        return;
      }
      if (!res.ok) {
        showToast(lang === "ar" ? "تعذّرت المقارنة، حاول تاني" : "Comparison failed, please try again");
        return;
      }

      const result = await res.json();
      setCurrentCompare(result);
    } catch (e) {
      showToast(lang === "ar" ? "تعذّرت المقارنة، حاول تاني" : "Comparison failed, please try again");
    } finally {
      setLoading(false);
    }
  };

  const cShort = currencies.find((c) => c.code === currency);
  const shortLabel = lang === "ar" ? cShort?.arShort : cShort?.enShort;

  const bilingual = (bt: { ar: string; en: string }) => (lang === "ar" ? bt.ar : bt.en);

  if (currentCompare) {
    const IconA = getCategoryIcon(currentCompare.productA);
    const IconB = getCategoryIcon(currentCompare.productB);

    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => { setCurrentCompare(null); navigate("input"); }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/50 text-zinc-400 transition-colors hover:text-amber-400"
          >
            {dir === "rtl" ? <ChevronLeft className="h-5 w-5 rotate-180" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <h1 className="font-serif text-2xl font-bold text-amber-400">{t("compareProducts")}</h1>
        </div>

        {/* VS Header */}
        <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="text-center">
            <div className="relative mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black shadow-lg ring-1 ring-amber-500/20">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent" />
              <IconA className="relative h-8 w-8 text-amber-400/90" strokeWidth={1.5} />
            </div>
            <h3 className="truncate text-sm font-bold text-zinc-100">{currentCompare.productA}</h3>
            <p className="text-xs text-amber-400">{currentCompare.priceA.toLocaleString()} {shortLabel}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
            <span className="text-sm font-bold text-[#0B0B0F]">{t("vs")}</span>
          </div>
          <div className="text-center">
            <div className="relative mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black shadow-lg ring-1 ring-amber-500/20">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent" />
              <IconB className="relative h-8 w-8 text-amber-400/90" strokeWidth={1.5} />
            </div>
            <h3 className="truncate text-sm font-bold text-zinc-100">{currentCompare.productB}</h3>
            <p className="text-xs text-amber-400">{currentCompare.priceB.toLocaleString()} {shortLabel}</p>
          </div>
        </div>

        {/* Comparison Rows */}
        <div className="mb-6 space-y-2">
          {currentCompare.rows.map((row, i) => (
            <div key={i} className="rounded-xl border border-amber-500/15 bg-zinc-900/60 p-4">
              <p className="mb-3 text-center text-xs font-bold text-amber-400">{bilingual(row.category)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-lg p-3 text-center text-sm ${
                  row.winner === "A" ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "bg-zinc-800/40"
                }`}>
                  <div className="flex items-center justify-center gap-1.5">
                    {row.winner === "A" && <Check className="h-4 w-4 text-amber-400" />}
                    <span className={row.winner === "A" ? "text-amber-400 font-medium" : "text-zinc-300"}>
                      {bilingual(row.valueA)}
                    </span>
                  </div>
                </div>
                <div className={`rounded-lg p-3 text-center text-sm ${
                  row.winner === "B" ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "bg-zinc-800/40"
                }`}>
                  <div className="flex items-center justify-center gap-1.5">
                    {row.winner === "B" && <Check className="h-4 w-4 text-amber-400" />}
                    <span className={row.winner === "B" ? "text-amber-400 font-medium" : "text-zinc-300"}>
                      {bilingual(row.valueB)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Final Recommendation */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-6 text-center shadow-lg">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
            <Sparkles className="h-6 w-6 text-amber-400" />
          </div>
          <h3 className="mb-2 font-serif text-lg font-bold text-amber-400">{t("finalRecommendation")}</h3>
          <p className="text-sm leading-relaxed text-amber-100">{bilingual(currentCompare.finalRecommendation)}</p>
        </div>

        <Button onClick={() => { setCurrentCompare(null); navigate("input"); }} variant="outline" className="mt-6 w-full border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-amber-400">
          {t("newDecisionBtn")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate("input")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/50 text-zinc-400 transition-colors hover:text-amber-400"
        >
          {dir === "rtl" ? <ChevronLeft className="h-5 w-5 rotate-180" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <h1 className="font-serif text-2xl font-bold text-amber-400">{t("compareProducts")}</h1>
      </div>

      <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-b from-zinc-900/80 to-[#0B0B0F] p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
            <GitCompare className="h-7 w-7 text-[#0B0B0F]" />
          </div>
          <p className="text-sm text-zinc-400">{t("compareProducts")}</p>
        </div>

        <div className="space-y-5">
          {/* Product A */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-amber-400">{t("productA")}</Label>
            <Input
              value={productA}
              onChange={(e) => setProductA(e.target.value)}
              placeholder={t("productNamePlaceholder")}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <Input
              type="number"
              value={priceA}
              onChange={(e) => setPriceA(e.target.value)}
              placeholder={t("offeredPrice")}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50"
            />
          </div>

          {/* VS Divider */}
          <div className="flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
              <span className="text-xs font-bold text-[#0B0B0F]">{t("vs")}</span>
            </div>
          </div>

          {/* Product B */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-amber-400">{t("productB")}</Label>
            <Input
              value={productB}
              onChange={(e) => setProductB(e.target.value)}
              placeholder={t("productNamePlaceholder")}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <Input
              type="number"
              value={priceB}
              onChange={(e) => setPriceB(e.target.value)}
              placeholder={t("offeredPrice")}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-300">{t("currency")}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-100 focus:border-amber-500/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-800 text-zinc-100">
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="focus:bg-amber-500/20 focus:text-amber-400">
                    {lang === "ar" ? `${c.arName} (${c.arShort})` : `${c.enName} (${c.enShort})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCompare}
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-[#0B0B0F] font-bold hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B0B0F] border-t-transparent" />
                {lang === "ar" ? "جاري المقارنة..." : "Comparing..."}
              </span>
            ) : (
              <><GitCompare className="h-4 w-4" /> {t("compareNow")}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}