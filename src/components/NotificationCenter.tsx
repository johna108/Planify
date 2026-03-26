import React, { useMemo, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAppContext } from "../context/AppContext";

export function NotificationCenter() {
  const { state, dismissNotification } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  const activeNotifications = useMemo(
    () => state.notifications.filter((notification) => !notification.dismissed),
    [state.notifications],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-md p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
        title="Notifications"
      >
        {activeNotifications.length > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {activeNotifications.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
            {Math.min(activeNotifications.length, 99)}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-stone-800">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-stone-400 hover:text-stone-600"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {activeNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-500">No active notifications.</div>
            ) : (
              <div className="p-2 space-y-2">
                {activeNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-800">{notification.taskTitle}</p>
                        <p className="mt-0.5 text-xs text-stone-600">{notification.message}</p>
                        <p className="mt-1 text-[11px] text-stone-500">
                          {format(parseISO(notification.scheduledFor), "EEE, MMM d • h:mm a")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Bell size={13} className="text-amber-600" />
                        <button
                          onClick={() => dismissNotification(notification.id)}
                          className="text-stone-400 hover:text-stone-600"
                          title="Dismiss"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
