import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAppContext } from "../context/AppContext";
import { ScheduledTask } from "../context/AppContext";

type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  extendedProperties?: {
    private?: {
      planifyTaskId?: string;
    };
  };
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
};

type EventDraft = {
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
};

type StoredGoogleSession = {
  accessToken: string;
  connectedEmail: string | null;
  expiresAt: number;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const GOOGLE_CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SESSION_STORAGE_KEY = "planify_google_calendar_session_v1";
const DEFAULT_TOKEN_TTL_MS = 50 * 60 * 1000;

function readStoredGoogleSession(): StoredGoogleSession | null {
  try {
    const raw = window.localStorage.getItem(GOOGLE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGoogleSession;
    if (!parsed?.accessToken || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearStoredGoogleSession() {
  try {
    window.localStorage.removeItem(GOOGLE_SESSION_STORAGE_KEY);
  } catch {
    return;
  }
}

function storeGoogleSession(session: StoredGoogleSession) {
  try {
    window.localStorage.setItem(GOOGLE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    return;
  }
}

function toLocalDateTimeInputValue(date: Date) {
  const rounded = new Date(date);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15, 0, 0);
  const year = rounded.getFullYear();
  const month = String(rounded.getMonth() + 1).padStart(2, "0");
  const day = String(rounded.getDate()).padStart(2, "0");
  const hours = String(rounded.getHours()).padStart(2, "0");
  const minutes = String(rounded.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultDraft(): EventDraft {
  const start = new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    summary: "",
    description: "",
    location: "",
    startDateTime: toLocalDateTimeInputValue(start),
    endDateTime: toLocalDateTimeInputValue(end),
  };
}

function buildTaskDescription(task: ScheduledTask) {
  const base = task.description?.trim() || "";
  return base ? `${base}\n\nCreated by Planify` : "Created by Planify";
}

function sameInstant(a?: string, b?: string) {
  if (!a || !b) return false;
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return false;
  return aMs === bMs;
}

export function GoogleCalendarView() {
  const { state } = useAppContext();
  const [tokenClient, setTokenClient] = useState<{
    requestAccessToken: (options?: { prompt?: string }) => void;
  } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft>(getDefaultDraft());
  const [actionState, setActionState] = useState<"idle" | "saving" | "deleting">("idle");
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [syncingTaskIds, setSyncingTaskIds] = useState<string[]>([]);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  const persistGoogleSession = (token: string, email: string | null, expiresAtOverride?: number) => {
    const existing = readStoredGoogleSession();
    const expiresAt =
      expiresAtOverride ??
      (existing?.accessToken === token ? existing.expiresAt : Date.now() + DEFAULT_TOKEN_TTL_MS);

    storeGoogleSession({
      accessToken: token,
      connectedEmail: email,
      expiresAt,
    });
  };

  const hasClientId = useMemo(() => Boolean(GOOGLE_CLIENT_ID), []);

  const formatEventTime = (event: GoogleCalendarEvent) => {
    const startDateTime = event.start?.dateTime;
    const startDate = event.start?.date;
    if (startDateTime) {
      return format(parseISO(startDateTime), "EEE, MMM d • h:mm a");
    }
    if (startDate) {
      return `${format(parseISO(`${startDate}T00:00:00`), "EEE, MMM d")} • All day`;
    }
    return "Time unavailable";
  };

  const getEventStartDate = (event: GoogleCalendarEvent) => {
    if (event.start?.dateTime) {
      return parseISO(event.start.dateTime);
    }
    if (event.start?.date) {
      return parseISO(`${event.start.date}T00:00:00`);
    }
    return null;
  };

  const groupedEvents = useMemo(() => {
    const groups: { label: string; items: GoogleCalendarEvent[] }[] = [];
    const byDay = new Map<string, GoogleCalendarEvent[]>();
    for (const event of events) {
      const start = getEventStartDate(event);
      const key = start ? format(start, "yyyy-MM-dd") : "unknown";
      if (!byDay.has(key)) {
        byDay.set(key, []);
      }
      byDay.get(key)!.push(event);
    }
    for (const [key, items] of byDay.entries()) {
      const label = key === "unknown" ? "No Date" : format(parseISO(`${key}T00:00:00`), "EEEE, MMM d");
      groups.push({ label, items });
    }
    return groups;
  }, [events]);

  const visibleEventIds = useMemo(() => events.map((event) => event.id), [events]);
  const selectedCount = selectedEventIds.length;
  const allVisibleSelected = visibleEventIds.length > 0 && selectedEventIds.length === visibleEventIds.length;

  const syncedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of events) {
      const taskId = event.extendedProperties?.private?.planifyTaskId;
      if (taskId) {
        ids.add(taskId);
      }
    }
    return ids;
  }, [events]);

  const tasksToSync = useMemo(() => {
    return state.tasks.filter((task) => {
      if (!task.scheduledStart || !task.scheduledEnd) return false;
      if (task.status === "Completed" || task.status === "Missed") return false;
      if (syncedTaskIds.has(task.id)) return false;
      if (syncingTaskIds.includes(task.id)) return false;
      return true;
    });
  }, [state.tasks, syncedTaskIds, syncingTaskIds]);

  const tasksById = useMemo(() => {
    const map = new Map<string, ScheduledTask>();
    for (const task of state.tasks) {
      map.set(task.id, task);
    }
    return map;
  }, [state.tasks]);

  const linkedEvents = useMemo(() => {
    return events.filter((event) => Boolean(event.extendedProperties?.private?.planifyTaskId));
  }, [events]);

  const linkedEventsToDelete = useMemo(() => {
    return linkedEvents.filter((event) => {
      const taskId = event.extendedProperties?.private?.planifyTaskId;
      if (!taskId) return false;
      return !tasksById.has(taskId);
    });
  }, [linkedEvents, tasksById]);

  const linkedEventsToUpdate = useMemo(() => {
    return linkedEvents.filter((event) => {
      const taskId = event.extendedProperties?.private?.planifyTaskId;
      if (!taskId) return false;
      const task = tasksById.get(taskId);
      if (!task) return false;

      const expectedDescription = buildTaskDescription(task);
      const startsMatch = sameInstant(event.start?.dateTime, task.scheduledStart);
      const endsMatch = sameInstant(event.end?.dateTime, task.scheduledEnd);
      const titleMatch = (event.summary || "") === task.title;
      const descriptionMatch = (event.description || "") === expectedDescription;

      return !(startsMatch && endsMatch && titleMatch && descriptionMatch);
    });
  }, [linkedEvents, tasksById]);

  const authorizedFetch = async (url: string, init?: RequestInit) => {
    if (!accessToken) {
      throw new Error("Please connect your Google account first.");
    }
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        setAccessToken(null);
        setConnectedEmail(null);
        clearStoredGoogleSession();
        throw new Error("Google session expired. Please reconnect your Google account.");
      }
      const payload = await response.text();
      throw new Error(payload || "Google Calendar request failed.");
    }
    return response;
  };

  const fetchConnectedEmail = async (token: string) => {
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;
      const data = await response.json();
      if (data?.email) {
        const email = String(data.email);
        setConnectedEmail(email);
        persistGoogleSession(token, email);
        return email;
      }
      persistGoogleSession(token, null);
      return null;
    } catch {
      setConnectedEmail(null);
      persistGoogleSession(token, null);
      return null;
    }
  };

  const fetchEvents = async (token: string) => {
    setIsLoadingEvents(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        timeMin: new Date().toISOString(),
        maxResults: "50",
        singleEvents: "true",
        orderBy: "startTime",
      });
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        if (response.status === 401) {
          setAccessToken(null);
          setConnectedEmail(null);
          clearStoredGoogleSession();
          setError("Google session expired. Please reconnect your Google account.");
          return;
        }
        throw new Error("Failed to fetch Google Calendar events.");
      }
      const data = await response.json();
      const nextEvents = Array.isArray(data.items) ? data.items : [];
      setEvents(nextEvents);
      const nextEventIds = new Set(nextEvents.map((event: GoogleCalendarEvent) => event.id));
      setSelectedEventIds((prev) => prev.filter((id) => nextEventIds.has(id)));
    } catch (err: any) {
      setError(err?.message || "Unable to load events.");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!hasClientId) {
      setIsInitializing(false);
      return;
    }
    let cancelled = false;
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-google-gsi='true']");
    const initTokenClient = () => {
      if (cancelled || !window.google?.accounts?.oauth2) return;
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_CALENDAR_SCOPE,
        callback: async (response) => {
          if (response.error || !response.access_token) {
            if (response.error !== "interaction_required") {
              setError("Google sign-in failed. Please try again.");
            }
            setIsLoadingEvents(false);
            return;
          }

          const expiresAt = Date.now() + ((response.expires_in ?? DEFAULT_TOKEN_TTL_MS / 1000) * 1000);
          setAccessToken(response.access_token);
          persistGoogleSession(response.access_token, null, expiresAt);
          await fetchConnectedEmail(response.access_token);
          await fetchEvents(response.access_token);
        },
      });
      setTokenClient(client);

      const storedSession = readStoredGoogleSession();
      if (storedSession && storedSession.expiresAt > Date.now()) {
        setAccessToken(storedSession.accessToken);
        setConnectedEmail(storedSession.connectedEmail);
        void fetchConnectedEmail(storedSession.accessToken);
        void fetchEvents(storedSession.accessToken);
      } else if (storedSession) {
        clearStoredGoogleSession();
        setIsLoadingEvents(true);
        client.requestAccessToken({ prompt: "" });
      }

      setIsInitializing(false);
    };

    if (existingScript) {
      if (window.google?.accounts?.oauth2) {
        initTokenClient();
      } else {
        existingScript.addEventListener("load", initTokenClient);
      }
      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", initTokenClient);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "true";
    script.onload = initTokenClient;
    script.onerror = () => {
      setError("Failed to load Google Identity Services.");
      setIsInitializing(false);
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.onload = null;
      script.onerror = null;
    };
  }, [hasClientId]);

  useEffect(() => {
    if (!accessToken || tasksToSync.length === 0 || actionState !== "idle") return;

    const syncTasks = async () => {
      const pendingTaskIds = tasksToSync.map((task) => task.id);
      setSyncingTaskIds((prev) => [...new Set([...prev, ...pendingTaskIds])]);

      try {
        const results = await Promise.allSettled(
          tasksToSync.map((task) => {
            const payload = {
              summary: task.title,
              description: `${task.description || ""}\n\nCreated by Planify`,
              start: { dateTime: task.scheduledStart },
              end: { dateTime: task.scheduledEnd },
              extendedProperties: {
                private: {
                  planifyTaskId: task.id,
                },
              },
            };

            return authorizedFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
              method: "POST",
              body: JSON.stringify(payload),
            });
          }),
        );

        const failedCount = results.filter((result) => result.status === "rejected").length;
        if (failedCount > 0) {
          setError(`${failedCount} new task(s) failed to sync to Google Calendar.`);
        }

        await fetchEvents(accessToken);
      } catch (err: any) {
        setError(err?.message || "Failed to sync new tasks to Google Calendar.");
      } finally {
        setSyncingTaskIds((prev) => prev.filter((id) => !pendingTaskIds.includes(id)));
      }
    };

    void syncTasks();
  }, [accessToken, tasksToSync, actionState]);

  useEffect(() => {
    if (!accessToken || actionState !== "idle") return;
    if (linkedEventsToDelete.length === 0 && linkedEventsToUpdate.length === 0) return;

    const syncMutations = async () => {
      setActionState("saving");
      setError(null);

      try {
        const deleteResults = await Promise.allSettled(
          linkedEventsToDelete.map((event) =>
            authorizedFetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event.id)}`,
              { method: "DELETE" },
            ),
          ),
        );

        const updateResults = await Promise.allSettled(
          linkedEventsToUpdate.map((event) => {
            const taskId = event.extendedProperties?.private?.planifyTaskId as string;
            const task = tasksById.get(taskId) as ScheduledTask;

            const payload = {
              summary: task.title,
              description: buildTaskDescription(task),
              start: { dateTime: task.scheduledStart },
              end: { dateTime: task.scheduledEnd },
              extendedProperties: {
                private: {
                  planifyTaskId: task.id,
                },
              },
            };

            return authorizedFetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event.id)}`,
              {
                method: "PATCH",
                body: JSON.stringify(payload),
              },
            );
          }),
        );

        const failedDeletes = deleteResults.filter((result) => result.status === "rejected").length;
        const failedUpdates = updateResults.filter((result) => result.status === "rejected").length;

        await fetchEvents(accessToken);

        if (failedDeletes > 0 || failedUpdates > 0) {
          setError(`${failedDeletes + failedUpdates} task sync update(s) failed. Please refresh and try again.`);
        }
      } catch (err: any) {
        setError(err?.message || "Failed syncing task changes to Google Calendar.");
      } finally {
        setActionState("idle");
      }
    };

    void syncMutations();
  }, [accessToken, actionState, linkedEventsToDelete, linkedEventsToUpdate, tasksById]);

  const handleConnect = () => {
    if (!tokenClient) return;
    setError(null);
    setIsLoadingEvents(true);
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent select_account" });
  };

  const handleDisconnect = () => {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken);
    }
    setAccessToken(null);
    setEvents([]);
    setError(null);
    setEditingEventId(null);
    setIsComposerOpen(false);
    setDraft(getDefaultDraft());
    setSelectedEventIds([]);
    setConnectedEmail(null);
    clearStoredGoogleSession();
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedEventIds([]);
    } else {
      setSelectedEventIds(visibleEventIds);
    }
  };

  const handleDeleteSelectedEvents = async () => {
    if (!accessToken || selectedEventIds.length === 0) return;

    const shouldDelete = window.confirm(`Delete ${selectedEventIds.length} selected Google Calendar event(s)?`);
    if (!shouldDelete) return;

    setActionState("deleting");
    setError(null);

    try {
      const results = await Promise.allSettled(
        selectedEventIds.map((eventId) =>
          authorizedFetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
            {
              method: "DELETE",
            },
          ),
        ),
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;
      await fetchEvents(accessToken);
      setSelectedEventIds([]);

      if (failedCount > 0) {
        setError(`${failedCount} event(s) could not be deleted. Try again.`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete selected events.");
    } finally {
      setActionState("idle");
    }
  };

  const handleOpenCreate = () => {
    setEditingEventId(null);
    setDraft(getDefaultDraft());
    setIsComposerOpen(true);
    setError(null);
  };

  const handleOpenEdit = (event: GoogleCalendarEvent) => {
    const start = event.start?.dateTime ? parseISO(event.start.dateTime) : new Date();
    const end = event.end?.dateTime ? parseISO(event.end.dateTime) : new Date(start.getTime() + 60 * 60 * 1000);
    setEditingEventId(event.id);
    setDraft({
      summary: event.summary || "",
      description: event.description || "",
      location: event.location || "",
      startDateTime: toLocalDateTimeInputValue(start),
      endDateTime: toLocalDateTimeInputValue(end),
    });
    setIsComposerOpen(true);
    setError(null);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    setEditingEventId(null);
    setDraft(getDefaultDraft());
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setError("Connect your Google account first.");
      return;
    }
    if (!draft.summary.trim()) {
      setError("Event title is required.");
      return;
    }
    const startDate = new Date(draft.startDateTime);
    const endDate = new Date(draft.endDateTime);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError("Invalid event start/end date.");
      return;
    }
    if (endDate <= startDate) {
      setError("Event end time must be after start time.");
      return;
    }

    setActionState("saving");
    setError(null);
    try {
      const payload = {
        summary: draft.summary.trim(),
        description: draft.description.trim() || undefined,
        location: draft.location.trim() || undefined,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
      };

      if (editingEventId) {
        await authorizedFetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(editingEventId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await authorizedFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await fetchEvents(accessToken);
      closeComposer();
    } catch (err: any) {
      setError(err?.message || "Failed to save event.");
    } finally {
      setActionState("idle");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!accessToken) return;
    const shouldDelete = window.confirm("Delete this Google Calendar event?");
    if (!shouldDelete) return;

    setActionState("deleting");
    setError(null);
    try {
      await authorizedFetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: "DELETE",
        },
      );
      await fetchEvents(accessToken);
      if (editingEventId === eventId) {
        closeComposer();
      }
    } catch (err: any) {
      const message = String(err?.message || "Failed to delete event.");
      if (message.toLowerCase().includes("insufficient") || message.includes("403")) {
        setError("Delete failed due to Google permissions. Disconnect and reconnect Google Calendar, then try again.");
      } else {
        setError(message);
      }
    } finally {
      setActionState("idle");
    }
  };

  const shellClassName = isMaximized
    ? "fixed inset-4 z-50 bg-white rounded-2xl border border-slate-300 shadow-2xl flex flex-col"
    : "h-full min-h-[460px] max-h-[900px] bg-white rounded-xl border border-slate-300 shadow-sm flex flex-col resize-y overflow-hidden";

  return (
    <>
      {isMaximized && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-40"
          onClick={() => setIsMaximized(false)}
        />
      )}

      <div className={shellClassName}>
        <div className="h-10 border-b border-slate-200 px-3 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-500 ml-2">calendar.google.com</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Open
              <ExternalLink size={12} />
            </a>
            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              type="button"
              className="text-slate-500 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-200"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
            <Calendar size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Google Calendar Window</h2>
            <p className="text-xs text-slate-500">Create, edit, and delete events directly from Planify</p>
            {connectedEmail && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Connected as <span className="font-medium text-slate-700">{connectedEmail}</span>
              </p>
            )}
          </div>
        </div>

        <div className="p-3 border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2">
            {!accessToken ? (
              <button
                onClick={handleConnect}
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <LogIn size={14} />
                Connect your Google account
              </button>
            ) : (
              <>
                <button
                  onClick={() => accessToken && fetchEvents(accessToken)}
                  type="button"
                  disabled={isLoadingEvents || actionState !== "idle"}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                >
                  {isLoadingEvents ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Refresh
                </button>
                <button
                  onClick={handleOpenCreate}
                  type="button"
                  disabled={actionState !== "idle"}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                >
                  <Plus size={14} />
                  Add event
                </button>
                <button
                  onClick={toggleSelectAllVisible}
                  type="button"
                  disabled={visibleEventIds.length === 0 || actionState !== "idle"}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-md text-sm font-medium disabled:opacity-60"
                >
                  {allVisibleSelected ? "Clear selection" : "Select all"}
                </button>
                <button
                  onClick={handleDeleteSelectedEvents}
                  type="button"
                  disabled={selectedCount === 0 || actionState !== "idle"}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-60"
                >
                  Delete selected {selectedCount > 0 ? `(${selectedCount})` : ""}
                </button>
                <button
                  onClick={handleDisconnect}
                  type="button"
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <LogOut size={14} />
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-3">
          {!hasClientId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Add <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> in <code className="font-mono">.env</code> to enable Google Calendar editing.
            </div>
          ) : isInitializing ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin" />
              Initializing Google Calendar...
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">
                  {error}
                </div>
              )}

              {!accessToken ? (
                <div className="h-full min-h-[220px] flex items-center justify-center text-sm text-slate-500 text-center px-6 bg-white border border-slate-200 rounded-lg">
                  Connect your Google account to view and manage your events directly from this app.
                </div>
              ) : isLoadingEvents ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 size={16} className="animate-spin" />
                  Loading events...
                </div>
              ) : events.length === 0 ? (
                <div className="h-full min-h-[220px] flex items-center justify-center text-sm text-slate-500 text-center px-4 bg-white border border-slate-200 rounded-lg">
                  No upcoming events found. Click "Add event" to create one.
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedEvents.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{group.label}</p>
                      <div className="space-y-2">
                        {group.items.map((event) => (
                          <div key={event.id} className="border border-slate-200 bg-white rounded-lg p-3 hover:border-indigo-300 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={selectedEventIds.includes(event.id)}
                                  onChange={() => toggleEventSelection(event.id)}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  title="Select event"
                                  disabled={actionState !== "idle"}
                                />
                                <p className="text-sm font-semibold text-slate-800 truncate">{event.summary || "Untitled event"}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleOpenEdit(event);
                                  }}
                                  type="button"
                                  className="text-slate-500 hover:text-indigo-600 p-2 rounded-md hover:bg-indigo-50"
                                  title="Edit event"
                                  disabled={actionState !== "idle"}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteEvent(event.id);
                                  }}
                                  type="button"
                                  className="text-slate-500 hover:text-red-600 p-2 rounded-md hover:bg-red-50"
                                  title="Delete event"
                                  disabled={actionState !== "idle"}
                                >
                                  <Trash2 size={15} />
                                </button>
                                {event.htmlLink && (
                                  <a
                                    href={event.htmlLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-400 hover:text-indigo-600 p-1 rounded"
                                    title="Open in Google Calendar"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{formatEventTime(event)}</p>
                            {event.location && <p className="text-xs text-slate-500 mt-1 truncate">{event.location}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!isMaximized && (
          <div className="h-5 flex items-center justify-center border-t border-slate-200 bg-slate-50">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
        )}
      </div>

      {isComposerOpen && accessToken && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeComposer} />
          <div className="relative w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{editingEventId ? "Edit event" : "Create event"}</h3>
              <button
                onClick={closeComposer}
                type="button"
                className="text-slate-500 hover:text-slate-700 p-1 rounded"
                disabled={actionState !== "idle"}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                <input
                  value={draft.summary}
                  onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="Event title"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                  placeholder="Optional details"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                <input
                  value={draft.location}
                  onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="Optional location"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={draft.startDateTime}
                    onChange={(e) => setDraft((prev) => ({ ...prev, startDateTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End</label>
                  <input
                    type="datetime-local"
                    value={draft.endDateTime}
                    onChange={(e) => setDraft((prev) => ({ ...prev, endDateTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeComposer}
                  className="px-3 py-2 rounded-md border border-slate-300 text-slate-700 text-sm"
                  disabled={actionState !== "idle"}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60"
                  disabled={actionState !== "idle"}
                >
                  {actionState === "saving" ? "Saving..." : editingEventId ? "Save changes" : "Create event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
