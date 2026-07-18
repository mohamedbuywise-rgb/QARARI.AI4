import { useApp } from "@/lib/AppContext";
import { CheckCircle2 } from "lucide-react";

export function Toast() {
  const { toast, dir } = useApp();
  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-6 ${dir === "rtl" ? "left-6" : "right-6"} z-50 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-zinc-900/95 px-4 py-3 shadow-xl shadow-amber-500/10 backdrop-blur-md`}
    >
      <CheckCircle2 className="h-5 w-5 text-amber-400" />
      <span className="text-sm font-medium text-zinc-100">{toast}</span>
    </div>
  );
}