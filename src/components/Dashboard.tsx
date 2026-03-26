import React, { useState } from "react";
import { InputPanel } from "./InputPanel";
import { WorkflowVisualizer } from "./WorkflowVisualizer";
import { TaskView } from "./TaskView";
import { GoogleCalendarView } from "./GoogleCalendarView";
import { SummaryView } from "./SummaryView";
import {
  BrainCircuit,
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import { NotificationCenter } from "./NotificationCenter";

type DashboardProps = {
  pathname: string;
  onNavigate: (path: string) => void;
};

export function Dashboard({ pathname, onNavigate }: DashboardProps) {
  const { signOut, state } = useAppContext();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const pendingCount = state.tasks.filter((task) => task.status === "Pending" || task.status === "Rescheduled").length;
  const completedCount = state.tasks.filter((task) => task.status === "Completed").length;
  const rescheduledCount = state.tasks.filter((task) => task.status === "Rescheduled").length;
  const totalCount = state.tasks.length;

  const activeSection: "dashboard" | "tasks" | "calendar" =
    pathname === "/tasks" ? "tasks" : pathname === "/calendar" ? "calendar" : "dashboard";

  const openSection = (section: "dashboard" | "tasks" | "calendar" | "settings") => {
    if (section === "settings") {
      setIsProfileOpen(true);
      return;
    }

    if (section === "dashboard") {
      onNavigate("/");
      return;
    }

    onNavigate(`/${section}`);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <div className="mx-auto max-w-[1480px] px-4 py-4">
        <div
          className={`grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-4 ${
            activeSection === "dashboard"
              ? "lg:grid-cols-[220px_minmax(0,1fr)_360px]"
              : "lg:grid-cols-[220px_minmax(0,1fr)]"
          }`}
        >
          <aside className="hidden rounded-2xl border border-stone-200 bg-white p-4 lg:block lg:p-5">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-stone-50">
                <BrainCircuit size={20} />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight">Planify</h1>
                <p className="text-[11px] text-stone-500">Adaptive Productivity</p>
              </div>
            </div>

            <div className="mt-5 space-y-1">
              <SidebarItem
                icon={<LayoutDashboard size={16} />}
                label="Dashboard"
                active={activeSection === "dashboard"}
                onClick={() => openSection("dashboard")}
              />
              <SidebarItem
                icon={<ListTodo size={16} />}
                label="Tasks"
                active={activeSection === "tasks"}
                onClick={() => openSection("tasks")}
              />
              <SidebarItem
                icon={<CalendarDays size={16} />}
                label="Calendar"
                active={activeSection === "calendar"}
                onClick={() => openSection("calendar")}
              />
              <SidebarItem
                icon={<Settings size={16} />}
                label="Settings"
                onClick={() => openSection("settings")}
              />
            </div>

            <div className="mt-6 border-t border-stone-200 pt-4 space-y-2">
              <button
                onClick={() => setIsProfileOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                title="Profile settings"
              >
                <User size={16} /> Profile
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                title="Sign out"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </aside>

          <main className="rounded-2xl border border-stone-200 bg-white p-4 lg:p-5 overflow-hidden">
            <div className="mb-3 flex flex-col gap-2 border-b border-stone-200 pb-3 sm:flex-row sm:items-center sm:justify-between lg:hidden">
              <div className="min-w-0 flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <SidebarItem
                  icon={<LayoutDashboard size={14} />}
                  label="Dashboard"
                  active={activeSection === "dashboard"}
                  onClick={() => openSection("dashboard")}
                  compact
                />
                <SidebarItem
                  icon={<ListTodo size={14} />}
                  label="Tasks"
                  active={activeSection === "tasks"}
                  onClick={() => openSection("tasks")}
                  compact
                />
                <SidebarItem
                  icon={<CalendarDays size={14} />}
                  label="Calendar"
                  active={activeSection === "calendar"}
                  onClick={() => openSection("calendar")}
                  compact
                />
              </div>
              <div className="flex items-center gap-1 self-end sm:self-auto">
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="rounded-md p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                  title="Profile settings"
                >
                  <User size={16} />
                </button>
                <button
                  onClick={signOut}
                  className="rounded-md p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-stone-900">
                  {activeSection === "tasks" ? "Tasks" : activeSection === "calendar" ? "Calendar" : "Dashboard"}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {activeSection === "tasks"
                    ? "Manage tasks in one focused place."
                    : activeSection === "calendar"
                    ? "View and sync your schedule."
                    : "Plan faster with a calm, focused workspace."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <NotificationCenter />
              </div>
            </header>

            {activeSection === "tasks" && (
              <div className="grid grid-cols-1 gap-4">
                <PanelShell title="Tasks" subtitle="All tasks in one focused view">
                  <TaskView />
                </PanelShell>
              </div>
            )}

            {activeSection === "calendar" && (
              <div className="h-[70vh] min-h-[420px] max-h-[90vh] resize-y overflow-auto rounded-xl border border-stone-200 bg-stone-50 sm:min-h-[520px]">
                <GoogleCalendarView />
              </div>
            )}

            {activeSection === "dashboard" && (
              <>
                <section className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                  <span className="font-medium text-stone-800">{totalCount}</span> total tasks ·{" "}
                  <span className="font-medium text-stone-800">{pendingCount}</span> pending ·{" "}
                  <span className="font-medium text-stone-800">{completedCount}</span> completed ·{" "}
                  <span className="font-medium text-stone-800">{rescheduledCount}</span> rescheduled
                </section>

                <div className="grid grid-cols-1 gap-4">
                  <PanelShell title="Smart Input" subtitle="Drop ideas and structure tasks">
                    <InputPanel />
                  </PanelShell>
                  <PanelShell title="Tasks" subtitle="Prioritized and adaptive task queue">
                    <TaskView />
                  </PanelShell>
                  {state.summary && (
                    <PanelShell title="Summary" subtitle="Insights from your latest planning cycle">
                      <SummaryView />
                    </PanelShell>
                  )}
                </div>
              </>
            )}
          </main>

          {activeSection === "dashboard" && (
            <aside className="rounded-2xl border border-stone-200 bg-white p-4 lg:p-5 min-h-[60vh]">
              <div className="mb-4">
                <WorkflowVisualizer />
              </div>
              <div className="mb-4 border-b border-stone-200 pb-3">
                <h3 className="text-sm font-semibold text-stone-900">Calendar</h3>
                <p className="mt-1 text-xs text-stone-600">Two-way sync with Google Calendar</p>
              </div>
              <div className="h-[70vh] min-h-[420px] max-h-[90vh] resize-y overflow-auto rounded-xl border border-stone-200 bg-stone-50 sm:min-h-[520px]">
                <GoogleCalendarView />
              </div>
            </aside>
          )}
        </div>
      </div>

      <ProfileSettingsModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`flex items-center gap-2 rounded-lg transition-colors ${
        compact ? "shrink-0 px-2.5 py-1.5 text-xs" : "w-full px-3 py-2 text-sm"
      } ${active ? "bg-stone-900 text-stone-50" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"}`}
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

const PanelShell = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-2 border-b border-stone-200 px-1 pb-2">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        <p className="mt-0.5 text-[11px] text-stone-500">{subtitle}</p>
      </div>
      <div>{children}</div>
    </section>
  );
};
