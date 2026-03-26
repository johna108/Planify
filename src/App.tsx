import React, { useEffect, useState } from "react";
import { AppProvider, useAppContext } from "./context/AppContext";
import { Dashboard } from "./components/Dashboard";
import { Auth } from "./components/Auth";
import { Onboarding } from "./components/Onboarding";
import { LandingPage } from "./components/LandingPage";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { state } = useAppContext();
  const [pathname, setPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === path) {
      setPathname(path);
      return;
    }

    window.history.pushState({}, "", path);
    setPathname(path);
  };

  useEffect(() => {
    if (state.isLoadingAuth || state.user) return;
    if (pathname === "/auth" || pathname === "/landing") return;
    navigateTo("/landing");
  }, [state.isLoadingAuth, state.user, pathname]);

  useEffect(() => {
    if (!state.user || state.isLoadingAuth) return;

    const allowedPaths = ["/", "/tasks", "/calendar", "/landing", "/auth"];
    if (!allowedPaths.includes(pathname)) {
      navigateTo("/");
    }
  }, [state.user, state.isLoadingAuth, pathname]);

  if (state.isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (pathname === "/landing") {
    return (
      <LandingPage
        onGetStarted={() => {
          if (!state.user) {
            navigateTo("/auth");
            return;
          }

          navigateTo("/");
        }}
      />
    );
  }

  if (!state.user) {
    if (pathname === "/auth") {
      return <Auth />;
    }

    return <LandingPage onGetStarted={() => navigateTo("/auth")} />;
  }

  if (!state.availability) {
    return <Onboarding />;
  }

  return <Dashboard pathname={pathname} onNavigate={navigateTo} />;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
