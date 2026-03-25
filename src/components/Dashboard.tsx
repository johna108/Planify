import React, { useState } from "react";
import { InputPanel } from "./InputPanel";
import { WorkflowVisualizer } from "./WorkflowVisualizer";
import { TaskView } from "./TaskView";
import { GoogleCalendarView } from "./GoogleCalendarView";
import { SummaryView } from "./SummaryView";
import { BrainCircuit, LogOut, User } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { ProfileSettingsModal } from "./ProfileSettingsModal";

export function Dashboard() {
  const { signOut } = useAppContext();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-sm">
              <BrainCircuit size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                Planify
              </h1>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Powered by TRAE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Agent Active
            </div>
            <button
              onClick={() => setIsProfileOpen(true)}
              className="text-slate-500 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors"
              title="Profile settings"
            >
              <User size={18} />
            </button>
            <button
              onClick={signOut}
              className="text-slate-500 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Input & Summary */}
          <div className="lg:col-span-4 space-y-6">
            <InputPanel />
            <SummaryView />
          </div>

          {/* Middle Column: Workflow & Tasks */}
          <div className="lg:col-span-4 space-y-6 flex flex-col h-[calc(100vh-8rem)]">
            <WorkflowVisualizer />
            <div className="flex-1 min-h-0">
              <TaskView />
            </div>
          </div>

          {/* Right Column: Calendar */}
          <div className="lg:col-span-4 h-[calc(100vh-8rem)]">
            <GoogleCalendarView />
          </div>
        </div>
      </main>

      <ProfileSettingsModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}
