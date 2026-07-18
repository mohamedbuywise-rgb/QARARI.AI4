import { useEffect, useRef, useState } from "react";

// One-time story intro shown before the main app on a fresh browser session.
// Scene 1: hook line (the problem) -> Scene 2: price comparison + savings
// count-up (the value, framed as an illustrative example, not a guarantee)
// -> Scene 3: wordmark + tagline. Skips itself entirely if already shown
// this session, and is never shown on the admin route.

const SESSION_KEY = "qarari_splash_shown";
const SCENE1_MS = 2000;
const SCENE2_START = 2400;
const SCENE2_STRIKE = 3100;
const SCENE2_COUNT = 3600;
const SCENE2_END = 6200;
const SCENE3_START = 6600;
const TOTAL_MS = 8600;

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<0 | 1 | 2 | 3>(1);
  const [savings, setSavings] = useState(0);
  const [struck, setStruck] = useState(false);

  // Ambient drifting gold dust — runs continuously behind all scenes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const dust = Array.from({ length: 55 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.3 + Math.random() * 0.7,
      size: 0.6 + Math.random() * 1.3,
      drift: (Math.random() - 0.5) * 0.12,
      twinkle: Math.random() * Math.PI * 2,
    }));

    let rafId: number;
    function draw(t: number) {
      ctx!.clearRect(0, 0, W, H);
      for (const d of dust) {
        d.x += d.drift * d.z;
        d.y += Math.sin(t / 3200 + d.x * 0.01) * 0.04;
        if (d.x < -10) d.x = W + 10;
        if (d.x > W + 10) d.x = -10;
        const tw = 0.5 + 0.5 * Math.sin(t / 500 + d.twinkle);
        const alpha = 0.1 * d.z * tw;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(212,175,55,${alpha})`;
        ctx!.fill();
      }
      rafId = requestAnimationFrame(draw);
    }
    rafId = requestAnimationFrame(draw);

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Scene sequencing
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    at(SCENE1_MS, () => setScene(0)); // fade scene 1 out
    at(SCENE2_START, () => setScene(2));
    at(SCENE2_STRIKE, () => setStruck(true));
    at(SCENE2_COUNT, () => {
      const target = 6500;
      const start = performance.now();
      const duration = 1100;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setSavings(Math.round(eased * target));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    at(SCENE2_END, () => setScene(0));
    at(SCENE3_START, () => setScene(3));
    at(TOTAL_MS, () => {
      sessionStorage.setItem(SESSION_KEY, "1");
      onFinish();
    });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bgdark overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md px-7 text-center">
        {/* Scene 1: hook line */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700"
          style={{ opacity: scene === 1 ? 1 : 0 }}
        >
          <p className="text-2xl font-light leading-relaxed text-zinc-200">
            كل يوم بتتخذ <span className="font-semibold text-gold">قرارات شراء</span>
            <br />
            من غير ما تعرف السعر العادل فعلاً
          </p>
        </div>

        {/* Scene 2: price comparison + savings */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700"
          style={{ opacity: scene === 2 ? 1 : 0 }}
        >
          <div className="mb-4 text-[0.78rem] uppercase tracking-[0.25em] text-zinc-500">
            تحليل لحظي بالذكاء الاصطناعي
          </div>
          <div className="mb-2 flex items-baseline justify-center gap-3">
            <span
              className="relative text-2xl text-zinc-500"
              style={{
                textDecoration: struck ? "line-through" : "none",
                textDecorationColor: "#c0453f",
                textDecorationThickness: "2px",
                transition: "text-decoration-color 0.3s ease",
              }}
            >
              25,000 ج.م
            </span>
            <span className="text-xl text-gold">←</span>
            <span className="text-3xl font-bold text-amber-200">18,500 ج.م</span>
          </div>
          <div
            className="mt-5 inline-flex flex-col items-center gap-1 rounded-2xl border px-8 py-3.5 transition-all duration-500"
            style={{
              borderColor: "rgba(212,175,55,0.35)",
              background: "rgba(212,175,55,0.06)",
              opacity: savings > 0 ? 1 : 0,
              transform: savings > 0 ? "translateY(0)" : "translateY(8px)",
            }}
          >
            <span className="text-2xl font-bold text-gold">
              {savings.toLocaleString("en-US")} ج.م
            </span>
            <span className="text-[0.7rem] uppercase tracking-widest text-zinc-400">
              كنت هتوفرهم
            </span>
          </div>
          <p className="mt-4 text-[0.68rem] text-zinc-600">*مثال توضيحي لنتيجة تحليل حقيقي</p>
        </div>

        {/* Scene 3: wordmark */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700"
          style={{ opacity: scene === 3 ? 1 : 0 }}
        >
          <div
            className="text-4xl font-bold tracking-wide"
            style={{
              background:
                "linear-gradient(100deg, #D4AF37 0%, #f6dfa0 45%, #D4AF37 60%, #f6dfa0 100%)",
              backgroundSize: "220% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Qarari.AI
          </div>
          <p className="mt-2.5 text-sm text-zinc-400">
            حلّل أي قرار شراء في ثواني، قبل ما تدفع زيادة
          </p>
          <p className="mt-6 text-[0.72rem] uppercase tracking-[0.2em] text-zinc-600">
            جاري التحميل…
          </p>
        </div>
      </div>
    </div>
  );
}

export function shouldShowSplash(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== "1";
  } catch {
    return true; // if storage is unavailable for any reason, default to showing it once
  }
}
