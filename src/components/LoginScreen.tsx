import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Mail, Lock, ChevronLeft, User } from "lucide-react";

export function LoginScreen() {
  const { t, lang, dir, navigate, signIn, signUp, showToast, pendingAction, setPendingAction } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showToast(lang === "ar" ? "اكتب البريد وكلمة المرور" : "Enter email and password");
      return;
    }
    setLoading(true);

    // Section 10: real auth calls, wrapped, with translated error feedback —
    // never a silently non-responsive button.
    const { error } = mode === "signup" ? await signUp(email.trim(), password) : await signIn(email.trim(), password);

    setLoading(false);

    if (error) {
      showToast(
        lang === "ar"
          ? "تعذر تسجيل الدخول: تحقق من البيانات"
          : `Login failed: ${error}`
      );
      return;
    }

    showToast(
      mode === "signup"
        ? lang === "ar" ? "تم إنشاء الحساب! تحقق من بريدك للتأكيد إذا لزم الأمر." : "Account created! Check your email to confirm if required."
        : lang === "ar" ? "تم تسجيل الدخول!" : "Logged in!"
    );

    // Save the display name entered at signup, if a session is available yet
    // (it may not be, if email confirmation is required before login works).
    if (mode === "signup" && name.trim()) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        await supabase.from("users").update({ full_name: name.trim() }).eq("id", sessionData.session.user.id);
      }
    }

    // Section 7: resume the originally-intended action (save/reminder/watch)
    // automatically after successful auth — no repeated tap needed.
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    } else {
      navigate("input");
    }
  };

  const handleGuest = () => {
    navigate("input");
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-6">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-xl shadow-amber-500/20">
          <Sparkles className="h-8 w-8 text-[#0B0B0F]" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-amber-400">{t("appName")}</h1>
        <p className="mt-1 text-sm text-zinc-400">{t("welcomeBack")}</p>
      </div>

      <div className="w-full rounded-2xl border border-amber-500/15 bg-gradient-to-b from-zinc-900/80 to-[#0B0B0F] p-6 shadow-2xl">
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "text-zinc-400 hover:text-amber-400"
            }`}
          >
            {t("login")}
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "text-zinc-400 hover:text-amber-400"
            }`}
          >
            {t("signup")}
          </button>
        </div>

        <div className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-300">{t("profileName")}</Label>
              <div className="relative">
                <User className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600 ${dir === "rtl" ? "right-3" : "left-3"}`} />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("profileName")}
                  className={`border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 ${dir === "rtl" ? "pr-10" : "pl-10"}`}
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-300">{t("email")}</Label>
            <div className="relative">
              <Mail className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600 ${dir === "rtl" ? "right-3" : "left-3"}`} />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 ${dir === "rtl" ? "pr-10" : "pl-10"}`}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-300">{t("password")}</Label>
            <div className="relative">
              <Lock className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600 ${dir === "rtl" ? "right-3" : "left-3"}`} />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 ${dir === "rtl" ? "pr-10" : "pl-10"}`}
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full bg-gradient-to-r from-amber-400 to-amber-600 text-[#0B0B0F] font-bold hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
        >
          {loading ? "..." : mode === "login" ? t("login") : t("signup")}
        </Button>

        <div className="mt-4 text-center">
          <p className="text-xs text-zinc-600">{t("orContinueAs")}</p>
          <button
            onClick={handleGuest}
            className="mt-2 text-sm font-medium text-amber-400 hover:text-amber-300"
          >
            {t("guest")}
          </button>
        </div>
      </div>

      <button
        onClick={() => navigate("input")}
        className="mt-6 flex items-center gap-1 text-sm text-zinc-500 hover:text-amber-400"
      >
        {dir === "rtl" ? <ChevronLeft className="h-4 w-4 rotate-180" /> : <ChevronLeft className="h-4 w-4" />}
        {t("back")}
      </button>
    </div>
  );
}