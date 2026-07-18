import { useEffect, useState } from "react";
import {
  Shield, LogOut, Inbox, BarChart3, DollarSign, Check, X,
  Loader2, RefreshCw, ExternalLink, Users, TrendingUp, Crown,
} from "lucide-react";
import { getStoredCreds, storeCreds, clearCreds, adminFetch } from "@/admin/adminApi";

type Tab = "requests" | "metrics" | "costs";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-username": username,
          "x-admin-password": password,
        },
      });
      if (!res.ok) {
        setError("بيانات الدخول غير صحيحة");
        return;
      }
      storeCreds({ username, password });
      onSuccess();
    } catch {
      setError("حصل خطأ، حاول تاني");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0B0F] px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl border border-amber-500/15 bg-zinc-900/60 p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
            <Shield className="h-7 w-7 text-[#0B0B0F]" />
          </div>
          <h1 className="font-serif text-xl font-bold text-amber-400">لوحة تحكم Qarari.AI</h1>
          <p className="mt-1 text-xs text-zinc-500">Admin Dashboard</p>
        </div>

        <div className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/50"
            autoComplete="username"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/50"
            autoComplete="current-password"
          />
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-bold text-[#0B0B0F] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          دخول
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Requests tab (approve/reject subscription requests)
// ---------------------------------------------------------------------------
interface SubRequest {
  id: string;
  plan: string;
  amount: number;
  status: string;
  screenshot_signed_url: string | null;
  created_at: string;
  users: { email: string; full_name: string | null } | null;
}

function RequestsTab() {
  const [requests, setRequests] = useState<SubRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReasonFor, setRejectReasonFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/requests");
      const data = await res.json();
      setRequests(data.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      await adminFetch("/api/admin/approve", { method: "POST", body: JSON.stringify({ requestId: id }) });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    try {
      await adminFetch("/api/admin/reject", { method: "POST", body: JSON.stringify({ requestId: id, reason: rejectReason || undefined }) });
      setRejectReasonFor(null);
      setRejectReason("");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>;
  }

  if (!requests.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-zinc-500">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">مفيش طلبات اشتراك معلّقة دلوقتي</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.id} className="rounded-xl border border-amber-500/15 bg-zinc-900/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-zinc-100">{r.users?.full_name || r.users?.email || "—"}</p>
              <p className="text-xs text-zinc-500">{r.users?.email}</p>
              <p className="mt-1 text-xs text-amber-400">
                اشتراك شهري — {r.amount} EGP
              </p>
              <p className="text-[11px] text-zinc-600">{new Date(r.created_at).toLocaleString("ar-EG")}</p>
            </div>
            {r.screenshot_signed_url && (
              <a
                href={r.screenshot_signed_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-amber-500/40 hover:text-amber-400"
              >
                <ExternalLink className="h-3.5 w-3.5" /> صورة التحويل
              </a>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => approve(r.id)}
              disabled={busyId === r.id}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> موافقة
            </button>
            <button
              onClick={() => setRejectReasonFor(rejectReasonFor === r.id ? null : r.id)}
              disabled={busyId === r.id}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/20 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> رفض
            </button>
          </div>

          {rejectReasonFor === r.id && (
            <div className="mt-3 flex gap-2">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="سبب الرفض (اختياري)"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-amber-500/50"
              />
              <button
                onClick={() => reject(r.id)}
                disabled={busyId === r.id}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                تأكيد الرفض
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics tab (Section 26 — Business Metrics Dashboard)
// ---------------------------------------------------------------------------
function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-amber-500/30 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/60"}`}>
      <div className="mb-2 flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-xl font-bold ${accent ? "text-amber-400" : "text-zinc-100"}`}>{value}</p>
    </div>
  );
}

function MetricsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/metrics");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-amber-400">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="إجمالي المستخدمين" value={data.totalUsers} />
        <StatCard icon={Crown} label="مشتركين بريميوم" value={data.premiumUsers} accent />
        <StatCard icon={TrendingUp} label="معدل التحويل" value={`${data.conversionRate}%`} />
        <StatCard icon={Users} label="تسجيلات آخر 7 أيام" value={data.newSignupsThisWeek} />
        <StatCard icon={BarChart3} label="تحليلات هذا الشهر" value={data.analysesThisMonth} />
        <StatCard icon={BarChart3} label="إجمالي التحليلات" value={data.totalAnalyses} />
        <StatCard icon={DollarSign} label="MRR تقديري" value={`${data.mrrEstimate.toLocaleString()} EGP`} accent />
        <StatCard icon={DollarSign} label="اشتراكات جديدة هذا الشهر" value={`${data.newMrrThisMonth.toLocaleString()} EGP`} />
        <StatCard icon={DollarSign} label="إجمالي الفلوس اللي وفّرها المستخدمين" value={`${data.totalMoneySaved.toLocaleString()} EGP`} />
        <StatCard icon={Inbox} label="طلبات معلّقة" value={data.pendingRequests} />
        <StatCard icon={Check} label="موافق عليها هذا الشهر" value={data.approvedThisMonth} />
        <StatCard icon={X} label="مرفوضة هذا الشهر" value={data.rejectedThisMonth} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Costs tab (Section 25 — AI Cost Dashboard)
// ---------------------------------------------------------------------------
function CostsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/ai-costs");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>;
  }

  const maxDay = Math.max(1, ...data.dailyTrend.map((d: any) => d.cost));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-amber-400">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={DollarSign} label="تكلفة تقديرية هذا الشهر" value={`$${data.totalCostThisMonth}`} accent />
        <StatCard icon={BarChart3} label="عدد طلبات Gemini" value={data.totalCallsThisMonth} />
        <StatCard icon={BarChart3} label="متوسط التكلفة/طلب" value={`$${data.avgCostPerCall}`} />
        <StatCard icon={BarChart3} label="إجمالي التوكنز" value={data.totalTokensThisMonth.toLocaleString()} />
      </div>

      {/* Daily trend, last 14 days */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="mb-3 text-xs font-bold text-zinc-400">التكلفة اليومية — آخر 14 يوم</p>
        <div className="flex h-32 items-end gap-1">
          {data.dailyTrend.map((d: any) => (
            <div key={d.date} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-amber-500/50 transition-colors group-hover:bg-amber-400"
                style={{ height: `${Math.max(4, (d.cost / maxDay) * 100)}%` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 group-hover:block">
                {d.date}: ${d.cost}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By model */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="mb-3 text-xs font-bold text-zinc-400">حسب الموديل</p>
        <div className="space-y-2">
          {Object.entries(data.byModel).map(([model, v]: any) => (
            <div key={model} className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">{model}</span>
              <span className="text-zinc-500">{v.calls} طلب — ${v.cost.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By endpoint */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="mb-3 text-xs font-bold text-zinc-400">حسب نوع الطلب</p>
        <div className="space-y-2">
          {Object.entries(data.byEndpoint).map(([ep, v]: any) => (
            <div key={ep} className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">{ep}</span>
              <span className="text-zinc-500">{v.calls} طلب — ${v.cost.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-zinc-600">{data.note}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
export default function AdminApp() {
  const [authed, setAuthed] = useState(() => !!getStoredCreds());
  const [tab, setTab] = useState<Tab>("requests");

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "requests", label: "طلبات الاشتراك", icon: Inbox },
    { id: "metrics", label: "مقاييس الأعمال", icon: BarChart3 },
    { id: "costs", label: "تكلفة الذكاء الاصطناعي", icon: DollarSign },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#0B0B0F] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-amber-500/15 bg-[#0B0B0F]/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600">
              <Shield className="h-4 w-4 text-[#0B0B0F]" />
            </div>
            <span className="font-serif text-sm font-bold text-amber-400">لوحة تحكم Qarari.AI</span>
          </div>
          <button
            onClick={() => { clearCreds(); setAuthed(false); }}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" /> خروج
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                tab === tb.id ? "bg-amber-500/15 text-amber-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <tb.icon className="h-3.5 w-3.5" /> {tb.label}
            </button>
          ))}
        </div>

        {tab === "requests" && <RequestsTab />}
        {tab === "metrics" && <MetricsTab />}
        {tab === "costs" && <CostsTab />}
      </div>
    </div>
  );
}
