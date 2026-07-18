import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { currencies } from "@/lib/types";
import type { Verdict } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, TrendingUp, TrendingDown, Calendar, Flame, Package } from "lucide-react";

export function HistoryScreen() {
  const { t, lang, dir, history, navigate, setCurrentReport, user } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Verdict>("all");

  const currencyShort = (code: string) => {
    const c = currencies.find((c) => c.code === code);
    return lang === "ar" ? c?.arShort : c?.enShort;
  };

  const stats = useMemo(() => {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonth = history.filter((h) => h.createdAt >= monthAgo);
    const totalSaved = history.reduce((sum, h) => sum + h.moneySaved, 0);
    const goodDeals = history.filter((h) => h.verdict === "good").length;
    const badDeals = history.filter((h) => h.verdict === "bad").length;

    const dates = [...new Set(history.map((h) => new Date(h.createdAt).toDateString()))].sort();
    let streak = 0;
    if (dates.length > 0) {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (dates.includes(today) || dates.includes(yesterday)) {
        let checkDate = dates.includes(today) ? new Date() : new Date(Date.now() - 86400000);
        while (dates.includes(checkDate.toDateString())) {
          streak++;
          checkDate = new Date(checkDate.getTime() - 86400000);
        }
      }
    }

    return { thisMonthCount: thisMonth.length, totalSaved, goodDeals, badDeals, streak };
  }, [history]);

  const filtered = useMemo(() => {
    return history.filter((h) => {
      const matchesSearch = h.product.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || h.verdict === filter;
      return matchesSearch && matchesFilter;
    });
  }, [history, search, filter]);

  const openReport = (id: string) => {
    const r = history.find((h) => h.id === id);
    if (r) {
      setCurrentReport(r);
      navigate("report");
    }
  };

  const verdictColor: Record<Verdict, string> = {
    good: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    fair: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    bad: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate("input")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/50 text-zinc-400 transition-colors hover:text-amber-400"
        >
          {dir === "rtl" ? <ChevronLeft className="h-5 w-5 rotate-180" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <h1 className="font-serif text-2xl font-bold text-amber-400">{t("historyTitle")}</h1>
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-amber-500/15 bg-gradient-to-b from-amber-500/10 to-transparent p-4 text-center">
          <TrendingUp className="mx-auto mb-1 h-5 w-5 text-amber-400" />
          <p className="text-lg font-bold text-amber-400">{stats.totalSaved.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">{t("totalSaved")}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
          <Calendar className="mx-auto mb-1 h-5 w-5 text-zinc-400" />
          <p className="text-lg font-bold text-zinc-100">{stats.thisMonthCount}</p>
          <p className="text-xs text-zinc-500">{t("decisionsThisMonth")}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
          <TrendingUp className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
          <p className="text-lg font-bold text-emerald-400">{stats.goodDeals}</p>
          <p className="text-xs text-zinc-500">{t("goodDeals")}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
          <Flame className="mx-auto mb-1 h-5 w-5 text-amber-400" />
          <p className="text-lg font-bold text-amber-400">{stats.streak}</p>
          <p className="text-xs text-zinc-500">{t("dayStreak")}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600 ${dir === "rtl" ? "right-3" : "left-3"}`} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchHistory")}
            className={`border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 ${dir === "rtl" ? "pr-10" : "pl-10"}`}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "good", "fair", "bad"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "bg-zinc-800/50 text-zinc-400 hover:text-amber-400"
              }`}
            >
              {t(f)}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 py-16 text-center">
          <Package className="mb-3 h-12 w-12 text-zinc-700" />
          <p className="text-sm font-medium text-zinc-400">{t("noHistory")}</p>
          <p className="mt-1 text-xs text-zinc-600">{t("noHistoryDesc")}</p>
          <Button onClick={() => navigate("input")} className="mt-4 bg-amber-500 text-[#0B0B0F] hover:bg-amber-400">
            {t("newDecision")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => {
            const Icon = getCategoryIcon(h.product);
            const cShort = currencyShort(h.currency);
            return (
              <button
                key={h.id}
                onClick={() => openReport(h.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-amber-500/15 bg-zinc-900/60 p-4 text-left transition-colors hover:border-amber-500/30 hover:bg-zinc-800/50"
              >
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black shadow-md ring-1 ring-amber-500/20">
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent" />
                  <Icon className="relative h-6 w-6 text-amber-400/90" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-zinc-100">{h.product}</h3>
                  <p className="text-xs text-zinc-500">
                    {new Date(h.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${verdictColor[h.verdict]}`}>
                    {t(h.verdict === "good" ? "goodDeal" : h.verdict === "fair" ? "fairDeal" : "badDeal")}
                  </span>
                  {h.moneySaved > 0 && (
                    <span className="text-xs font-bold text-emerald-400">
                      {h.moneySaved.toLocaleString()} {cShort}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}