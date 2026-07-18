import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { currencies, FREE_MONTHLY_LIMIT, SUPPORT_WHATSAPP } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  User, Mail, Phone, MapPin, Calendar, Gift, LogOut, Copy,
  Crown, Zap, MessageCircle, Send, ChevronLeft,
} from "lucide-react";

export function ProfileScreen() {
  const { t, lang, dir, user, signOut, navigate, isPremium, showToast, session } = useApp();
  const [scansUsed, setScansUsed] = useState(0);

  useEffect(() => {
    async function fetchUsage() {
      if (!session?.access_token) return;
      try {
        const res = await fetch("/api/scans-remaining", { headers: { Authorization: `Bearer ${session.access_token}` } });
        const data = await res.json();
        if (!data.unlimited && typeof data.remaining === "number") {
          setScansUsed(Math.max(0, FREE_MONTHLY_LIMIT - data.remaining));
        }
      } catch {
        // non-critical display value; ignore failures silently here
      }
    }
    fetchUsage();
  }, [session, isPremium]);

  if (!user) {
    navigate("login");
    return null;
  }

  const cShort = (code: string) => {
    const c = currencies.find((c) => c.code === code);
    return lang === "ar" ? c?.arShort : c?.enShort;
  };

  const handleLogout = async () => {
    await signOut();
    navigate("input");
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(`https://qarari.ai/r/${user.referralCode}`);
    showToast(t("copied"));
  };

  const subEndDate = user.subscriptionEndDate
    ? new Date(user.subscriptionEndDate).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate("input")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/50 text-zinc-400 transition-colors hover:text-amber-400"
        >
          {dir === "rtl" ? <ChevronLeft className="h-5 w-5 rotate-180" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <h1 className="font-serif text-2xl font-bold text-amber-400">{t("profile")}</h1>
      </div>

      {/* Profile Header */}
      <div className="mb-6 rounded-2xl border border-amber-500/15 bg-gradient-to-b from-zinc-900/80 to-[#0B0B0F] p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
            <span className="text-2xl font-bold text-[#0B0B0F]">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-100">{user.name}</h2>
              {isPremium && (
                <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/20 to-amber-600/20 px-2 py-0.5 text-xs font-bold text-amber-400 ring-1 ring-amber-500/30">
                  <Crown className="h-3 w-3" /> {t("premium")}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500">{user.email}</p>
            {isPremium && subEndDate ? (
              <p className="mt-1 text-xs text-amber-400/80">
                {t("premiumActive")} {subEndDate}
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                {t("freePlanStatus", { used: scansUsed, max: FREE_MONTHLY_LIMIT })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="mb-6 space-y-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-amber-400/70" />
            <div className="flex-1">
              <p className="text-xs text-zinc-500">{t("profileName")}</p>
              <p className="text-sm text-zinc-200">{user.name}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-amber-400/70" />
            <div className="flex-1">
              <p className="text-xs text-zinc-500">{t("profileEmail")}</p>
              <p className="text-sm text-zinc-200">{user.email}</p>
            </div>
          </div>
        </div>
        {user.phone && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-amber-400/70" />
              <div className="flex-1">
                <p className="text-xs text-zinc-500">{t("profilePhone")}</p>
                <p className="text-sm text-zinc-200">{user.phone}</p>
              </div>
            </div>
          </div>
        )}
        {user.country && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-amber-400/70" />
              <div className="flex-1">
                <p className="text-xs text-zinc-500">{t("profileCountry")}</p>
                <p className="text-sm text-zinc-200">{t(user.country)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Referral */}
      <div className="mb-6 rounded-xl border border-amber-500/15 bg-zinc-900/60 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-400">
          <Gift className="h-4 w-4" /> {t("referralCode")}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">
            <p className="font-mono text-sm text-amber-400">{user.referralCode}</p>
          </div>
          <Button onClick={copyReferral} variant="outline" className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-amber-400">
            <Copy className="h-4 w-4" /> {t("copyLink")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {t("inviteCount")}: <span className="font-bold text-amber-400">{user.inviteCount}</span>
        </p>
      </div>

      {/* Upgrade CTA (if free) */}
      {!isPremium && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-6 text-center">
          <Crown className="mx-auto mb-2 h-8 w-8 text-amber-400" />
          <h3 className="font-serif text-lg font-bold text-amber-400">{t("premium")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{t("upgradeDesc")}</p>
          <Button onClick={() => navigate("upgrade")} className="mt-4 bg-gradient-to-r from-amber-400 to-amber-600 text-[#0B0B0F] hover:from-amber-300 hover:to-amber-500">
            <Zap className="h-4 w-4" /> {t("subscribeNow")}
          </Button>
        </div>
      )}

      {/* Support Contact */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="mb-3 text-sm font-bold text-amber-400">{t("contactSupport")}</h3>
        <p className="mb-3 text-xs text-zinc-500">{t("needHelp")}</p>
        <div className="flex gap-3">
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            <MessageCircle className="h-4 w-4" /> {t("supportWhatsapp")}
          </a>
          <a
            href="https://t.me/qarari_support"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/10"
          >
            <Send className="h-4 w-4" /> {t("supportTelegram")}
          </a>
        </div>
      </div>

      {/* Logout */}
      <Button onClick={handleLogout} variant="outline" className="w-full border-red-500/20 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300">
        <LogOut className="h-4 w-4" /> {t("logout")}
      </Button>
    </div>
  );
}