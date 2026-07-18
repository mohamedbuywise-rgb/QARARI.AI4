import { AppProvider } from "@/lib/AppContext";
import { Header } from "@/components/Header";
import { Toast } from "@/components/Toast";
import { DecisionInput } from "@/components/DecisionInput";
import { ReportScreen } from "@/components/ReportScreen";
import { HistoryScreen } from "@/components/HistoryScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import { LoginScreen } from "@/components/LoginScreen";
import { UpgradeScreen } from "@/components/UpgradeScreen";
import { CompareScreen } from "@/components/CompareScreen";
import { useApp } from "@/lib/AppContext";

function ScreenRouter() {
  const { screen } = useApp();
  switch (screen) {
    case "input":
      return <DecisionInput />;
    case "report":
      return <ReportScreen />;
    case "history":
      return <HistoryScreen />;
    case "profile":
      return <ProfileScreen />;
    case "login":
      return <LoginScreen />;
    case "upgrade":
      return <UpgradeScreen />;
    case "compare":
      return <CompareScreen />;
    default:
      return <DecisionInput />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-[#0B0B0F] text-zinc-100 antialiased">
        <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-amber-950/10 via-transparent to-transparent" />
        <div className="relative z-10">
          <Header />
          <main className="pb-8">
            <ScreenRouter />
          </main>
          <footer className="border-t border-amber-500/10 px-4 py-6 text-center">
            <p className="text-xs text-zinc-600">
              Qarari.AI — {new Date().getFullYear()}
            </p>
          </footer>
        </div>
        <Toast />
      </div>
    </AppProvider>
  );
}