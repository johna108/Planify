import React from "react";
import { AppProvider, useAppContext } from "./context/AppContext";
import { Dashboard } from "./components/Dashboard";
import { Auth } from "./components/Auth";
import { Onboarding } from "./components/Onboarding";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { state } = useAppContext();

  if (state.isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!state.user) {
    return <Auth />;
  }

  if (!state.availability) {
    return <Onboarding />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
