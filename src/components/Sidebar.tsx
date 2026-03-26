// ...existing code...
import React from "react";
import { LayoutDashboard, Calendar, History, Settings, LogOut, CheckSquare } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { cn } from "../lib/utils";

export function Sidebar({ className }: { className?: string }) {
  const { signOut } = useAppContext();
  
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: CheckSquare, label: "My Tasks", active: false },
    { icon: Calendar, label: "Calendar", active: false },
    { icon: History, label: "History", active: false },
    { icon: Settings, label: "Settings", active: false },
  ];

  return (
    <aside className={cn("w-64 border-r bg-card flex flex-col h-screen sticky top-0", className)}>
      <div className="p-6 border-b border-border/50">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-foreground">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            P
          </div>
          Planify
        </h1>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">
          Workspace
        </div>
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              item.active 
                ? "bg-secondary text-foreground" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-border/50">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
