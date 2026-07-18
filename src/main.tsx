import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import AdminApp from "./admin/AdminApp.tsx"
import { SplashScreen, shouldShowSplash } from "@/components/SplashScreen"
import "./index.css"

// The Admin Dashboard (Section 15 approve/reject UI, plus Sections 25-26)
// lives at a configurable path — never guessable "/admin" by default — as a
// separate lightweight app that never shares state with the main consumer
// app, and is gated by its own username/password on top of that.
// Set VITE_ADMIN_ROUTE_SLUG in your env vars (e.g. "qarari-2511k26x");
// falls back to "/admin" if it isn't set.
const adminSlug = (import.meta.env.VITE_ADMIN_ROUTE_SLUG as string) || "admin"
const isAdminRoute = window.location.pathname.startsWith(`/${adminSlug}`)

function Root() {
  const [showSplash, setShowSplash] = React.useState(!isAdminRoute && shouldShowSplash())

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />
  }
  return isAdminRoute ? <AdminApp /> : <App />
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
