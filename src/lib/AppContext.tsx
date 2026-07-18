import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Language, Screen, AnalysisResult, UserProfile, CompareResult } from "@/lib/types";
import { translations } from "@/lib/translations";
import { getDemoReport } from "@/lib/analysisEngine";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  dir: "rtl" | "ltr";
  t: (key: string, params?: Record<string, string | number>) => string;
  screen: Screen;
  navigate: (screen: Screen) => void;
  currentReport: AnalysisResult | null;
  setCurrentReport: (r: AnalysisResult | null) => void;
  currentCompare: CompareResult | null;
  setCurrentCompare: (r: CompareResult | null) => void;
  history: AnalysisResult[];
  saveToHistory: (r: AnalysisResult) => Promise<void>;
  refreshHistory: () => Promise<void>;
  user: UserProfile | null;
  session: Session | null;
  authLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isPremium: boolean;
  showToast: (msg: string) => void;
  toast: string | null;
  pendingAction: (() => void) | null;
  setPendingAction: (a: (() => void) | null) => void;
  requireAuth: (action: () => void) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("qarari-lang");
    return (saved as Language) || "ar";
  });
  const [screen, setScreen] = useState<Screen>("input");
  const [currentReport, setCurrentReport] = useState<AnalysisResult | null>(null);
  const [currentCompare, setCurrentCompare] = useState<CompareResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    localStorage.setItem("qarari-lang", lang);
  }, [lang, dir]);

  const setLang = (l: Language) => setLangState(l);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let str = translations[lang][key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  }, [lang]);

  const navigate = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ---- Fetch the user's profile row (tier, scans, etc.) fresh from the DB ----
  // Re-run on every auth-state-change, never cached client-side, so the
  // Premium badge never goes stale after login/refresh/admin approval.
  const refreshUserProfile = useCallback(async (userId: string, email: string) => {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
    if (error || !data) {
      setUser(null);
      return;
    }
    setUser({
      id: data.id,
      email: data.email || email,
      name: data.full_name || "",
      age: data.age || "",
      country: data.country || "",
      phone: data.phone || "",
      interests: data.interests || [],
      tier: data.tier,
      subscriptionEndDate: data.subscription_end_date ? new Date(data.subscription_end_date).getTime() : null,
      referralCode: data.referral_code || "",
      inviteCount: data.invite_count || 0,
    });
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!session?.user) {
      setHistory([]);
      return;
    }
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setHistory(data.map((row: any) => ({ ...row.full_report, id: row.id, moneySaved: row.money_saved })));
    }
  }, [session]);

  // ---- Auth state listener: the single source of truth (fixes the "badge
  // disappears after login" bug — tier is always re-fetched here, never a
  // stale one-time value). ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        refreshUserProfile(newSession.user.id, newSession.user.email || "");
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [refreshUserProfile]);

  useEffect(() => {
    if (session?.user) {
      refreshHistory();
    }
  }, [session, refreshHistory]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message || null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setHistory([]);
  }, []);

  // Section 7 login-gating: run `action` now if signed in, otherwise stash it
  // and redirect to login; LoginScreen's success handler resumes it.
  // First-time-only: once session exists, this always takes the "run now" path.
  const requireAuth = useCallback((action: () => void) => {
    if (session?.user) {
      action();
    } else {
      setPendingAction(() => action);
      navigate("login");
    }
  }, [session, navigate]);

  const saveToHistory = useCallback(async (r: AnalysisResult) => {
    if (!session?.user) return;
    const { error } = await supabase.from("analyses").insert({
      user_id: session.user.id,
      product: r.product,
      offered_price: r.offeredPrice,
      currency: r.currency,
      verdict: r.verdict,
      market_fair_price_min: r.marketFairPriceMin,
      market_fair_price_max: r.marketFairPriceMax,
      market_fair_price_mid: r.marketFairPriceMid,
      money_saved: r.moneySaved,
      full_report: r,
    });
    if (error) return;

    await refreshHistory();

    // Section 12: maintain totalMoneySaved as a running total, never subtracting.
    if (r.moneySaved > 0) {
      const { data: row } = await supabase.from("users").select("total_money_saved").eq("id", session.user.id).single();
      await supabase
        .from("users")
        .update({ total_money_saved: (row?.total_money_saved || 0) + r.moneySaved })
        .eq("id", session.user.id);
    }
  }, [session, refreshHistory]);

  const isPremium = user?.tier === "premium";

  return (
    <AppContext.Provider value={{
      lang, setLang, dir, t, screen, navigate,
      currentReport, setCurrentReport,
      currentCompare, setCurrentCompare,
      history, saveToHistory, refreshHistory,
      user, session, authLoading,
      signUp, signIn, signOut,
      isPremium,
      showToast, toast,
      pendingAction, setPendingAction,
      requireAuth,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { getDemoReport };
