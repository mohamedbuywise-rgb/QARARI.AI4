import { useState, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { INSTAPAY_NUMBER } from "@/lib/types";
import { Crown, Upload, Check, ChevronLeft, Shield, Zap, Camera, X } from "lucide-react";

export function UpgradeScreen() {
  const { t, lang, navigate, showToast, session } = useApp();
  const plan = "monthly" as const;
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onload = () => setScreenshot(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleSubscribe = async () => {
    if (!session?.user) {
      showToast(lang === "ar" ? "سجّل دخول أولاً" : "Please sign in first");
      navigate("login");
      return;
    }
    if (!screenshotFile) {
      showToast(lang === "ar" ? "ارفع صورة التحويل الأول" : "Please upload the transfer screenshot first");
      return;
    }
    setLoading(true);
    try {
      // 1. Upload the real screenshot to Supabase Storage (private bucket,
      //    scoped to this user's own folder per the storage RLS policy).
      const path = `${session.user.id}/${Date.now()}-${screenshotFile.name}`;
      const { error: uploadError } = await supabase.storage.from("screenshots").upload(path, screenshotFile);
      if (uploadError) throw uploadError;

      // 2. Create the pending_review request — this does NOT grant Premium.
      //    Only an admin approval (Section 15) does that.
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan, screenshotUrl: path }),
      });

      if (!res.ok) throw new Error("subscribe_failed");

      setSubmitted(true);
      showToast(t("subRequestSent"));
    } catch (e) {
      showToast(lang === "ar" ? "حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى" : "Something went wrong submitting your request, please retry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button
        onClick={() => navigate("input")}
        className="mb-4 flex items-center gap-1 text-sm text-zinc-400 hover:text-amber-400"
      >
        <ChevronLeft className={`h-4 w-4 ${lang === "ar" ? "rotate-180" : ""}`} />
        {t("back")}
      </button>

      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-xl shadow-amber-500/20">
          <Crown className="h-8 w-8 text-[#0B0B0F]" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-amber-400">{t("premium")}</h1>
        <p className="mt-1 text-sm text-zinc-400">{t("premiumDesc")}</p>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="mb-2 font-serif text-xl font-bold text-amber-400">{t("subRequestSent")}</h2>
          <p className="text-sm text-zinc-400">{t("activationTime")}</p>
          <Button
            onClick={() => navigate("input")}
            className="mt-6 w-full bg-amber-500 text-[#0B0B0F] hover:bg-amber-400"
          >
            {t("back")}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Plan (monthly only) */}
          <div className="rounded-xl border-2 border-amber-500 bg-amber-500/10 p-4 text-center">
            <p className="text-sm font-medium text-zinc-300">{t("monthly")}</p>
            <p className="mt-1 text-2xl font-bold text-amber-400">149 EGP</p>
            <p className="text-xs text-zinc-500">{t("perMonth")}</p>
          </div>

          {/* Premium Benefits */}
          <div className="space-y-2.5 rounded-xl border border-amber-500/15 bg-zinc-900/60 p-4">
            {[t("premiumScansFeature"), t("premiumCompareFeature"), t("premiumChatFeature")].map((feature) => (
              <div key={feature} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="h-3 w-3 text-emerald-400" />
                </span>
                <p className="text-sm text-zinc-300">{feature}</p>
              </div>
            ))}
          </div>

          {/* Value reinforcement (animated) */}
          <div className="rounded-xl border border-amber-500/15 bg-zinc-900/60 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {t("valueSectionTitle")}
            </p>
            <p className="text-center text-xs text-zinc-500">{t("valueMessage")}</p>
            <div className="value-banner mt-3 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <span className="text-lg">🎉</span>
              <p className="text-sm font-bold text-emerald-400">{t("valueBanner")}</p>
            </div>
          </div>

          {/* Payment Section */}
          <div className="mb-4">
            {!showPayment ? (
              <Button
                onClick={() => setShowPayment(true)}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-[#0B0B0F] font-bold hover:from-amber-300 hover:to-amber-500"
              >
                <Zap className="h-4 w-4" /> {t("subscribeNow")}
              </Button>
            ) : (
              <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/60 p-6 shadow-lg">
                <h3 className="mb-4 font-serif text-lg font-bold text-amber-400">
                  {lang === "ar" ? "طريقة الدفع" : "Payment Method"}
                </h3>
                
                {/* InstaPay Info */}
                <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-sm text-zinc-300">
                    {lang === "ar" ? "حول المبلغ عبر InstaPay إلى:" : "Transfer the amount via InstaPay to:"}
                  </p>
                  <p className="mt-2 text-center font-mono text-2xl font-bold text-amber-400">
                    {INSTAPAY_NUMBER}
                  </p>
                </div>

                {/* Upload/Camera Section */}
                <div className="mb-4 space-y-1.5">
                  <Label className="text-sm font-medium text-zinc-300">
                    {lang === "ar" ? "ارفع صورة التحويل" : "Upload transfer screenshot"}
                  </Label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                  
                  {screenshot ? (
                    <div className="relative inline-block w-full">
                      <img src={screenshot} alt="screenshot" className="h-32 w-full max-w-xs rounded-lg border border-amber-500/20 object-cover" />
                      <button
                        onClick={() => setScreenshot(null)}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 py-2.5 text-xs text-zinc-500 transition-colors hover:border-amber-500/30 hover:text-amber-400"
                      >
                        <Upload className="h-4 w-4" />
                        <span>{lang === "ar" ? "اختر ملف" : "Choose file"}</span>
                      </button>
                      <button 
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 py-2.5 text-xs text-zinc-500 transition-colors hover:border-amber-500/30 hover:text-amber-400"
                      >
                        <Camera className="h-4 w-4" />
                        <span>{lang === "ar" ? "التقط صورة" : "Take photo"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Helper text and Confirm Button */}
                <p className="mb-4 text-xs text-zinc-500">
                  {lang === "ar" ? "سيتم تفعيل حسابك خلال 15-30 دقيقة بعد مراجعة التحويل." : "Your account will be activated within 15-30 minutes after transfer review."}
                </p>
                
                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-[#0B0B0F] font-bold hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
                >
                  {loading ? "..." : lang === "ar" ? "تأكيد الاشتراك" : "Confirm Subscription"}
                </Button>
              </div>
            )}
          </div>

          {/* Activation Time Note - bilingual */}
          <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center">
            <Shield className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-400">
              {lang === "ar"
                ? "سيتم تفعيل حسابك خلال 15-30 دقيقة بعد مراجعة التحويل"
                : "Your account will be activated within 15-30 minutes after the transfer is reviewed"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}