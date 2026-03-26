import React, { createContext, useContext, useState, useEffect } from "react";
import { addMinutes, isBefore, isAfter, parseISO, format, startOfDay, endOfDay, addDays } from "date-fns";
import { ExtractedTask } from "../services/ai";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";

export type TaskStatus = "Pending" | "Completed" | "Missed" | "Rescheduled";

export type AvailabilitySlot = {
  start: string;
  end: string;
};

export type LegacyDayAvailability = {
  enabled: boolean;
  start: string;
  end: string;
};

export type DayAvailability = AvailabilitySlot[] | LegacyDayAvailability | { slots: AvailabilitySlot[] };

export type UserAvailability = {
  [key: string]: DayAvailability;
};

export type ScheduledTask = ExtractedTask & {
  scheduledStart: string; // ISO string
  scheduledEnd: string; // ISO string
  status: TaskStatus;
  allowOutsideAvailability?: boolean;
  scheduledOutsideAvailability?: boolean;
};

type SchedulableTask = Omit<ExtractedTask, "id"> & {
  allowOutsideAvailability?: boolean;
};

export type SummaryData = {
  text: string;
  keyInsights: string[];
};

export type TaskHistoryAction = "Created" | "Updated" | "Deleted" | "StatusChanged" | "AutoScheduled" | "Rescheduled" | "ManualDecisionRequired";

export type TaskHistoryEntry = {
  id: string;
  taskId: string;
  taskTitle: string;
  action: TaskHistoryAction;
  details?: string;
  timestamp: string;
};

export type ReminderTiming = "at_time" | "5_min_before" | "15_min_before" | "1_hour_before" | "1_day_before";

export type ReminderSettings = {
  inAppReminders: ReminderTiming[];
};

export type Notification = {
  id: string;
  taskId: string;
  taskTitle: string;
  type: "reminder";
  reminderTiming: ReminderTiming;
  message: string;
  scheduledFor: string;
  createdAt: string;
  dismissed: boolean;
};


type AppState = {
  tasks: ScheduledTask[];
  taskHistory: TaskHistoryEntry[];
  manualDecisionTaskIds: string[];
  notifications: Notification[];
  triggeredReminderKeys: string[];
  reminderSettings: ReminderSettings;
  summary: SummaryData | null;
  isProcessing: boolean;
  workflowStep: "Idle" | "Extracting" | "Scheduling" | "Done";
  user: User | null;
  availability: UserAvailability | null;
  isLoadingAuth: boolean;
};

type AppContextType = {
  state: AppState;
  addTask: (task: Omit<ScheduledTask, "id">) => void;
  updateTask: (id: string, updates: Partial<Omit<ScheduledTask, "id">>) => void;
  deleteTask: (id: string) => void;
  clearAllTasks: () => void;
  dismissManualDecisionPrompt: (id: string) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  processNewInput: (input: string, extractedData: any) => void;
  simulateMissedTask: (id: string, source?: "manual" | "auto") => void;
  setWorkflowStep: (step: AppState["workflowStep"]) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setAvailability: (availability: UserAvailability) => void;
  updateReminderSettings: (settings: Partial<ReminderSettings>) => void;
  dismissNotification: (id: string) => void;
  signOut: () => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const APP_STORAGE_KEY = "planify_app_state_v1";

type PersistedAppState = {
  tasks: ScheduledTask[];
  taskHistory: TaskHistoryEntry[];
  manualDecisionTaskIds: string[];
  notifications: Notification[];
  triggeredReminderKeys: string[];
  reminderSettings: ReminderSettings;
  summary: SummaryData | null;
};

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  inAppReminders: ["1_hour_before", "5_min_before"],
};

function normalizeReminderSettings(value: unknown): ReminderSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_REMINDER_SETTINGS;
  }

  const candidate = value as {
    inAppReminders?: unknown;
    notificationReminders?: unknown;
  };

  const source = Array.isArray(candidate.inAppReminders)
    ? candidate.inAppReminders
    : Array.isArray(candidate.notificationReminders)
    ? candidate.notificationReminders
    : [];

  const normalized = source.filter(
    (timing): timing is ReminderTiming =>
      timing === "at_time" ||
      timing === "5_min_before" ||
      timing === "15_min_before" ||
      timing === "1_hour_before" ||
      timing === "1_day_before",
  );

  return {
    inAppReminders: normalized.length > 0 ? normalized : DEFAULT_REMINDER_SETTINGS.inAppReminders,
  };
}

function loadPersistedAppState(): PersistedAppState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      taskHistory: Array.isArray(parsed.taskHistory) ? parsed.taskHistory : [],
      manualDecisionTaskIds: Array.isArray(parsed.manualDecisionTaskIds) ? parsed.manualDecisionTaskIds : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      triggeredReminderKeys: Array.isArray(parsed.triggeredReminderKeys) ? parsed.triggeredReminderKeys : [],
      reminderSettings: normalizeReminderSettings(parsed.reminderSettings),
      summary: parsed.summary ?? null,
    };
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const generateId = () => Math.random().toString(36).substring(2, 12);

  const createHistoryEntry = (
    taskId: string,
    taskTitle: string,
    action: TaskHistoryAction,
    details?: string,
  ): TaskHistoryEntry => ({
    id: generateId(),
    taskId,
    taskTitle,
    action,
    details,
    timestamp: new Date().toISOString(),
  });

  const [state, setState] = useState<AppState>(() => {
    const persisted = loadPersistedAppState();

    return {
      tasks: persisted?.tasks || [],
      taskHistory: persisted?.taskHistory || [],
      manualDecisionTaskIds: persisted?.manualDecisionTaskIds || [],
      notifications: persisted?.notifications || [],
      triggeredReminderKeys: persisted?.triggeredReminderKeys || [],
      reminderSettings: normalizeReminderSettings(persisted?.reminderSettings),
      summary: persisted?.summary || null,
      isProcessing: false,
      workflowStep: "Idle",
      user: null,
      availability: null,
      isLoadingAuth: true,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: PersistedAppState = {
      tasks: state.tasks,
      taskHistory: state.taskHistory,
      manualDecisionTaskIds: state.manualDecisionTaskIds,
      notifications: state.notifications,
      triggeredReminderKeys: state.triggeredReminderKeys,
      reminderSettings: state.reminderSettings,
      summary: state.summary,
    };

    try {
      window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      return;
    }
  }, [state.tasks, state.taskHistory, state.manualDecisionTaskIds, state.notifications, state.triggeredReminderKeys, state.reminderSettings, state.summary]);

  const REMINDER_OFFSET_MINUTES: Record<ReminderTiming, number> = {
    at_time: 0,
    "5_min_before": 5,
    "15_min_before": 15,
    "1_hour_before": 60,
    "1_day_before": 24 * 60,
  };

  const reminderTimingLabel = (timing: ReminderTiming) => {
    switch (timing) {
      case "at_time":
        return "at start time";
      case "5_min_before":
        return "5 minutes before";
      case "15_min_before":
        return "15 minutes before";
      case "1_hour_before":
        return "1 hour before";
      case "1_day_before":
        return "1 day before";
      default:
        return "before";
    }
  };

  const getReminderDate = (scheduledStart: string, timing: ReminderTiming) => {
    const start = parseISO(scheduledStart);
    if (Number.isNaN(start.getTime())) return null;
    return addMinutes(start, -REMINDER_OFFSET_MINUTES[timing]);
  };

  const MANUAL_DECISION_KEYWORDS = [
    "internship",
    "interview",
    "exam",
    "doctor",
    "appointment",
    "class",
    "lecture",
    "shift",
    "work shift",
    "flight",
    "court",
    "visa",
    "embassy",
    "human control",
    "fixed time",
  ];

  const requiresManualDecision = (task: Pick<ScheduledTask, "title" | "description">) => {
    const text = `${task.title} ${task.description || ""}`.toLowerCase();
    return MANUAL_DECISION_KEYWORDS.some((keyword) => text.includes(keyword));
  };

  useEffect(() => {
    console.log('[AppContext] Initializing auth, checking hash');

    const handleOAuthPopupCompletion = () => {
      if (typeof window === 'undefined') return false;
      if (window.name !== 'oauth_popup') return false;
      if (!window.opener || window.opener.closed) return false;

      try {
        window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS' }, window.location.origin);
      } catch (err) {
        console.warn('[AppContext] Unable to notify opener window after OAuth success', err);
      }

      window.setTimeout(() => {
        window.close();
      }, 150);

      return true;
    };
    
    // Check if we're coming back from OAuth callback (hash contains session)
    if (window.location.hash) {
      console.log('[AppContext] Hash detected:', window.location.hash.substring(0, 50) + '...');
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AppContext] Initial session:', session?.user?.email ? `${session.user.email}` : 'null');

      if (session?.user && handleOAuthPopupCompletion()) {
        setState(prev => ({ ...prev, isLoadingAuth: false }));
        return;
      }

      setState(prev => ({ ...prev, user: session?.user ?? null }));
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, isLoadingAuth: false }));
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AppContext] Auth state changed, event:', _event, 'user:', session?.user?.email ?? 'null');

      if (session?.user && handleOAuthPopupCompletion()) {
        setState(prev => ({ ...prev, isLoadingAuth: false }));
        return;
      }

      setState(prev => ({ ...prev, user: session?.user ?? null }));
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, availability: null, isLoadingAuth: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('availability')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      
      setState(prev => ({ 
        ...prev, 
        availability: data?.availability || null,
        isLoadingAuth: false 
      }));
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, isLoadingAuth: false }));
    }
  };

  const setAvailability = (availability: UserAvailability) => {
    setState(prev => ({ ...prev, availability }));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const roundToNextQuarterHour = (date: Date) => {
    const rounded = new Date(date);
    rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15, 0, 0);
    return rounded;
  };

  const parseIsoDate = (value?: string) => {
    if (!value) return null;
    try {
      const parsed = parseISO(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const hasExplicitTimeComponent = (value?: string) => {
    if (!value) return false;
    const parsed = parseIsoDate(value);
    if (!parsed) return false;
    return parsed.getHours() !== 0 || parsed.getMinutes() !== 0 || parsed.getSeconds() !== 0;
  };

  const hasDayReferenceInText = (value?: string) => {
    if (!value) return false;
    const text = value.toLowerCase();

    const dayKeywords =
      /\b(today|tomorrow|tonight|monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun|next\s+week|next\s+(mon|tue|wed|thu|fri|sat|sun))\b/i;
    const datePatterns =
      /\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?)\b/i;

    return dayKeywords.test(text) || datePatterns.test(text);
  };

  const hasTimeReferenceInText = (value?: string) => {
    if (!value) return false;
    return /\b(?:at|by|around|before|after|@)\s*\d{1,2}(?::\d{2})?\s*(am|pm)?\b|\b\d{1,2}:\d{2}\s*(am|pm)?\b|\b\d{1,2}\s*(am|pm)\b/i.test(value);
  };

  const normalizeTimeOnlyPreferredStart = (preferred: Date, baseNow: Date) => {
    const normalized = new Date(baseNow);
    normalized.setSeconds(0, 0);
    normalized.setHours(preferred.getHours(), preferred.getMinutes(), 0, 0);

    if (isBefore(normalized, baseNow)) {
      return addDays(normalized, 1);
    }

    return normalized;
  };

  const resolvePreferredStart = (task: Omit<ExtractedTask, "id">) => {
    const explicitPreferredStart = parseIsoDate(task.preferredStart);
    if (explicitPreferredStart) return explicitPreferredStart;

    if (hasExplicitTimeComponent(task.deadline)) {
      return parseIsoDate(task.deadline);
    }

    return null;
  };

  const inferPreferredStartFromText = (text: string, base: Date) => {
    const normalized = text.toLowerCase();
    const timeMatch =
      normalized.match(/\b(?:at|by|around|before|after|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i) ||
      normalized.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)\b/i) ||
      normalized.match(/\b(\d{1,2})\s*(am|pm)\b/i) ||
      normalized.match(/\b(\d{1,2}):(\d{2})\b/i);
    if (!timeMatch) return null;

    const rawHour = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || "0");
    const meridiem = timeMatch[3]?.toLowerCase();
    const hasMinutes = typeof timeMatch[2] === "string";

    if (!Number.isFinite(rawHour) || minutes < 0 || minutes > 59) {
      return null;
    }

    let hour = rawHour;

    if (meridiem) {
      if (rawHour < 1 || rawHour > 12) {
        return null;
      }

      hour = rawHour % 12;
      if (meridiem === "pm") {
        hour += 12;
      }
    } else {
      if (hasMinutes) {
        if (rawHour < 0 || rawHour > 23) {
          return null;
        }
      } else {
        if (rawHour < 1 || rawHour > 12) {
          return null;
        }

        hour = rawHour % 12;
        if (rawHour !== 12) {
          hour += 12;
        }
      }
    }

    const inferred = new Date(base);
    inferred.setSeconds(0, 0);
    inferred.setHours(hour, minutes, 0, 0);

    if (normalized.includes("tomorrow")) {
      return addDays(inferred, 1);
    }

    if (normalized.includes("today")) {
      return inferred;
    }

    if (isBefore(inferred, base)) {
      return addDays(inferred, 1);
    }

    return inferred;
  };

  const resolveTaskPreferredStart = (task: Omit<ExtractedTask, "id">, rawInput?: string, now?: Date) => {
    const baseNow = now ?? new Date();

    const taskText = `${task.title || ""} ${task.description || ""}`.trim();
    const combinedText = `${taskText} ${rawInput || ""}`.trim();
    const inferredFromTask = inferPreferredStartFromText(taskText, baseNow);
    const inferredFromInput = rawInput ? inferPreferredStartFromText(rawInput, baseNow) : null;
    const explicitInputTime = hasTimeReferenceInText(rawInput);

    if (explicitInputTime && inferredFromInput) {
      return inferredFromInput;
    }

    const explicit = resolvePreferredStart(task);
    if (explicit) {
      const hasDayReference = hasDayReferenceInText(combinedText);
      const hasTimeReference = hasTimeReferenceInText(combinedText);

      if (!hasDayReference && hasTimeReference) {
        return normalizeTimeOnlyPreferredStart(explicit, baseNow);
      }

      return explicit;
    }

    if (inferredFromTask) return inferredFromTask;

    if (inferredFromInput) return inferredFromInput;

    return null;
  };

  type ScheduleOptions = {
    ignoreTextTimeInference?: boolean;
    minStartTime?: Date;
    availabilityOverride?: UserAvailability | null;
  };

  const resolveTaskPreferredStartWithOptions = (
    task: Omit<ExtractedTask, "id">,
    rawInput: string | undefined,
    now: Date,
    options?: ScheduleOptions,
  ) => {
    if (options?.ignoreTextTimeInference) {
      return resolvePreferredStart(task);
    }

    return resolveTaskPreferredStart(task, rawInput, now);
  };

  // Simple scheduling logic: find next available slot during working hours (9 AM - 6 PM)
  const normalizeDaySlots = (value: DayAvailability | undefined): AvailabilitySlot[] => {
    if (!value) {
      return [{ start: "09:00", end: "18:00" }];
    }

    if (Array.isArray(value)) {
      const slots = value.filter((slot) => slot && typeof slot.start === "string" && typeof slot.end === "string");
      return slots.length > 0 ? slots : [];
    }

    if (typeof value === "object" && Array.isArray((value as { slots?: AvailabilitySlot[] }).slots)) {
      const slots = (value as { slots: AvailabilitySlot[] }).slots.filter(
        (slot) => slot && typeof slot.start === "string" && typeof slot.end === "string",
      );
      return slots.length > 0 ? slots : [];
    }

    const legacy = value as LegacyDayAvailability;
    if (!legacy.enabled) {
      return [];
    }

    return [{ start: legacy.start || "09:00", end: legacy.end || "18:00" }];
  };

  const slotToDateRange = (baseDate: Date, slot: AvailabilitySlot) => {
    const [startHour, startMinute] = slot.start.split(":").map(Number);
    const [endHour, endMinute] = slot.end.split(":").map(Number);

    if (
      !Number.isFinite(startHour) ||
      !Number.isFinite(startMinute) ||
      !Number.isFinite(endHour) ||
      !Number.isFinite(endMinute)
    ) {
      return null;
    }

    const slotStart = new Date(baseDate);
    slotStart.setHours(startHour, startMinute, 0, 0);

    const slotEnd = new Date(baseDate);
    slotEnd.setHours(endHour, endMinute, 0, 0);

    if (!isBefore(slotStart, slotEnd)) {
      return null;
    }

    return { slotStart, slotEnd };
  };

  const scheduleTasks = (
    newTasks: SchedulableTask[],
    existingTasks: ScheduledTask[],
    rawInput?: string,
    options?: ScheduleOptions,
  ): ScheduledTask[] => {
    const now = new Date();
    const currentTime = roundToNextQuarterHour(now);
    const minStartTime = options?.minStartTime
      ? roundToNextQuarterHour(options.minStartTime)
      : currentTime;

    const scheduled: ScheduledTask[] = [];
    let currentSlot = currentTime;

    const isWithinAvailabilityRange = (
      start: Date,
      end: Date,
      availability: UserAvailability | null,
    ) => {
      const dayOfWeek = format(start, "EEEE").toLowerCase();
      const daySlotsRaw = availability
        ? normalizeDaySlots(availability[dayOfWeek])
        : [{ start: "09:00", end: "18:00" }];

      if (daySlotsRaw.length === 0) return false;

      const daySlots = daySlotsRaw
        .map((slot) => slotToDateRange(start, slot))
        .filter((slot): slot is { slotStart: Date; slotEnd: Date } => slot !== null)
        .sort((a, b) => a.slotStart.getTime() - b.slotStart.getTime());

      return daySlots.some((slot) => !isBefore(start, slot.slotStart) && !isAfter(end, slot.slotEnd));
    };

    const hasTaskConflict = (
      start: Date,
      end: Date,
      tasks: ScheduledTask[],
    ) => {
      return tasks.some((t) => {
        if (t.status === "Completed" || t.status === "Missed") return false;
        const tStart = parseISO(t.scheduledStart);
        const tEnd = parseISO(t.scheduledEnd);
        return (
          (isAfter(start, tStart) && isBefore(start, tEnd)) ||
          (isAfter(end, tStart) && isBefore(end, tEnd)) ||
          (isBefore(start, tStart) && isAfter(end, tEnd)) ||
          start.getTime() === tStart.getTime()
        );
      });
    };

    // Sort new tasks by priority (High > Medium > Low) and deadline
    const sortedTasks = [...newTasks].sort((a, b) => {
      const aPreferredStart = resolveTaskPreferredStartWithOptions(a, rawInput, now, options);
      const bPreferredStart = resolveTaskPreferredStartWithOptions(b, rawInput, now, options);

      if (aPreferredStart && bPreferredStart) {
        return aPreferredStart.getTime() - bPreferredStart.getTime();
      }
      if (aPreferredStart && !bPreferredStart) {
        return -1;
      }
      if (!aPreferredStart && bPreferredStart) {
        return 1;
      }

      const priorityWeight = { High: 3, Medium: 2, Low: 1 };
      if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      if (a.deadline && b.deadline) {
        return parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime();
      }
      return 0;
    });

    for (const task of sortedTasks) {
      const preferredStart = resolveTaskPreferredStartWithOptions(task, rawInput, now, options);
      const initialSlot = preferredStart
        ? new Date(preferredStart)
        : currentSlot;
      let taskSlot = initialSlot;
      while (isBefore(taskSlot, now) && preferredStart) {
        taskSlot = addDays(taskSlot, 1);
      }
      if (!preferredStart && isBefore(taskSlot, currentTime)) {
        taskSlot = currentTime;
      }

      if (isBefore(taskSlot, minStartTime)) {
        taskSlot = minStartTime;
      }

      // Find a gap
      let foundSlot = false;
      let attempts = 0; // prevent infinite loop if no availability

      while (!foundSlot && attempts < 1000) {
        attempts++;
        const activeAvailability = options?.availabilityOverride ?? state.availability;
        const duration = task.estimatedDurationMinutes || 30;

        const shouldTryOutsideAvailability = Boolean(task.allowOutsideAvailability && preferredStart);
        if (shouldTryOutsideAvailability) {
          const outsideCandidateStart = taskSlot;
          const outsideCandidateEnd = addMinutes(outsideCandidateStart, duration);
          const allTasks = [...existingTasks, ...scheduled];
          const hasConflict = hasTaskConflict(outsideCandidateStart, outsideCandidateEnd, allTasks);

          if (!hasConflict) {
            scheduled.push({
              ...task,
              id: Math.random().toString(36).substring(7),
              scheduledStart: outsideCandidateStart.toISOString(),
              scheduledEnd: outsideCandidateEnd.toISOString(),
              status: "Pending",
              scheduledOutsideAvailability: !isWithinAvailabilityRange(
                outsideCandidateStart,
                outsideCandidateEnd,
                activeAvailability,
              ),
            });
            currentSlot = isAfter(outsideCandidateEnd, currentSlot) ? outsideCandidateEnd : currentSlot;
            foundSlot = true;
            continue;
          }

          taskSlot = addMinutes(outsideCandidateStart, 15);
          continue;
        }
        
        // Use user availability slots if set, otherwise default 9-6
        const dayOfWeek = format(taskSlot, 'EEEE').toLowerCase();
        const daySlotsRaw = activeAvailability
          ? normalizeDaySlots(activeAvailability[dayOfWeek])
          : [{ start: "09:00", end: "18:00" }];

        if (daySlotsRaw.length === 0) {
          taskSlot = startOfDay(addDays(taskSlot, 1));
          continue;
        }

        const daySlots = daySlotsRaw
          .map((slot) => slotToDateRange(taskSlot, slot))
          .filter((slot): slot is { slotStart: Date; slotEnd: Date } => slot !== null)
          .sort((a, b) => a.slotStart.getTime() - b.slotStart.getTime());

        let candidateStart: Date | null = null;
        let proposedEnd: Date | null = null;

        for (const slot of daySlots) {
          if (taskSlot >= slot.slotEnd) {
            continue;
          }

          const slotCandidateStart = taskSlot < slot.slotStart ? slot.slotStart : taskSlot;
          const slotCandidateEnd = addMinutes(slotCandidateStart, duration);

          if (!isAfter(slotCandidateEnd, slot.slotEnd)) {
            candidateStart = slotCandidateStart;
            proposedEnd = slotCandidateEnd;
            break;
          }
        }

        if (!candidateStart || !proposedEnd) {
          taskSlot = startOfDay(addDays(taskSlot, 1));
          continue;
        }

        // Check for conflicts with existing tasks and newly scheduled tasks
        const allTasks = [...existingTasks, ...scheduled];
        const hasConflict = hasTaskConflict(candidateStart, proposedEnd, allTasks);

        if (!hasConflict) {
          scheduled.push({
            ...task,
            id: Math.random().toString(36).substring(7),
            scheduledStart: candidateStart.toISOString(),
            scheduledEnd: proposedEnd.toISOString(),
            status: "Pending",
            scheduledOutsideAvailability: false,
          });
          currentSlot = isAfter(proposedEnd, currentSlot) ? proposedEnd : currentSlot;
          foundSlot = true;
        } else {
          taskSlot = addMinutes(candidateStart, 15); // Try next 15 min slot
        }
      }
    }

    return scheduled;
  };

  const processNewInput = (input: string, extractedData: any) => {
    setState(prev => ({ ...prev, workflowStep: "Scheduling" }));
    
    setTimeout(() => {
      const now = new Date();
      const normalizedTasks = (extractedData.tasks || []).map((task: Omit<ExtractedTask, "id">): SchedulableTask => {
        const preferred = resolveTaskPreferredStart(task, input, now) ?? parseIsoDate(task.preferredStart);
        if (!preferred) return task;

        const preferredStart = preferred.toISOString();
        const preferredEnd = addMinutes(preferred, task.estimatedDurationMinutes || 30);
        const activeAvailability = state.availability;
        const outsideAvailability = (() => {
          const dayOfWeek = format(preferred, "EEEE").toLowerCase();
          const daySlotsRaw = activeAvailability
            ? normalizeDaySlots(activeAvailability[dayOfWeek])
            : [{ start: "09:00", end: "18:00" }];

          if (daySlotsRaw.length === 0) return true;

          const daySlots = daySlotsRaw
            .map((slot) => slotToDateRange(preferred, slot))
            .filter((slot): slot is { slotStart: Date; slotEnd: Date } => slot !== null)
            .sort((a, b) => a.slotStart.getTime() - b.slotStart.getTime());

          return !daySlots.some((slot) => !isBefore(preferred, slot.slotStart) && !isAfter(preferredEnd, slot.slotEnd));
        })();

        return {
          ...task,
          preferredStart,
          allowOutsideAvailability: outsideAvailability,
        };
      });

      const newScheduledTasks = scheduleTasks(normalizedTasks, state.tasks, input);
      const shiftedRequestedTimesCount = newScheduledTasks.filter((task) => {
        if (!task.preferredStart) return false;

        const requestedStart = parseISO(task.preferredStart);
        const finalStart = parseISO(task.scheduledStart);
        if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(finalStart.getTime())) return false;

        const diffMinutes = Math.abs(finalStart.getTime() - requestedStart.getTime()) / (1000 * 60);
        return diffMinutes >= 15;
      }).length;

      const timeShiftReason = "Some requested times were adjusted due to conflicts or availability.";
      const baseSummary = extractedData.summary as SummaryData | null;
      const adjustedSummary = (() => {
        if (shiftedRequestedTimesCount === 0) return baseSummary;

        if (!baseSummary) {
          return {
            text: timeShiftReason,
            keyInsights: [],
          } as SummaryData;
        }

        const currentText = baseSummary.text?.trim() || "";
        if (currentText.toLowerCase().includes("adjusted due to conflicts or availability")) {
          return baseSummary;
        }

        return {
          ...baseSummary,
          text: `${currentText} ${timeShiftReason}`.trim(),
        };
      })();

      const historyEntries = newScheduledTasks.map((task) =>
        createHistoryEntry(
          task.id,
          task.title,
          "AutoScheduled",
          `Scheduled for ${format(parseISO(task.scheduledStart), "MMM d, h:mm a")}`,
        ),
      );

      setState(prev => ({
        ...prev,
        tasks: [...prev.tasks, ...newScheduledTasks],
        taskHistory: [...historyEntries, ...prev.taskHistory].slice(0, 500),
        summary: adjustedSummary,
        workflowStep: "Done",
        isProcessing: false,
      }));
      
      setTimeout(() => {
        setState(prev => ({ ...prev, workflowStep: "Idle" }));
      }, 3000);
    }, 1500); // Simulate scheduling delay for TRAE visualization
  };

  const addTask = (task: Omit<ScheduledTask, "id">) => {
    const taskId = generateId();
    const historyEntry = createHistoryEntry(
      taskId,
      task.title,
      "Created",
      `Scheduled for ${format(parseISO(task.scheduledStart), "MMM d, h:mm a")}`,
    );

    setState(prev => ({
      ...prev,
      tasks: [...prev.tasks, { ...task, id: taskId }],
      taskHistory: [historyEntry, ...prev.taskHistory].slice(0, 500),
    }));
  };

  const updateTask = (id: string, updates: Partial<Omit<ScheduledTask, "id">>) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => (task.id === id ? { ...task, ...updates } : task)),
      taskHistory: (() => {
        const task = prev.tasks.find(t => t.id === id);
        if (!task) return prev.taskHistory;

        const updatedTask = { ...task, ...updates };
        const changedFields = Object.keys(updates);
        const details = changedFields.length > 0 ? `Updated fields: ${changedFields.join(", ")}` : "Task updated";

        return [
          createHistoryEntry(id, updatedTask.title, "Updated", details),
          ...prev.taskHistory,
        ].slice(0, 500);
      })(),
    }));
  };

  const deleteTask = (id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(task => task.id !== id),
      manualDecisionTaskIds: prev.manualDecisionTaskIds.filter(taskId => taskId !== id),
      taskHistory: (() => {
        const task = prev.tasks.find(t => t.id === id);
        if (!task) return prev.taskHistory;

        return [
          createHistoryEntry(id, task.title, "Deleted", "Task removed from plan"),
          ...prev.taskHistory,
        ].slice(0, 500);
      })(),
    }));
  };

  const clearAllTasks = () => {
    setState(prev => ({
      ...prev,
      tasks: [],
      manualDecisionTaskIds: [],
      taskHistory: prev.tasks.length
        ? [
            createHistoryEntry("bulk", "All tasks", "Deleted", `Deleted ${prev.tasks.length} task(s)`),
            ...prev.taskHistory,
          ].slice(0, 500)
        : prev.taskHistory,
    }));
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => (t.id === id ? { ...t, status } : t)),
      manualDecisionTaskIds:
        status === "Missed"
          ? prev.manualDecisionTaskIds
          : prev.manualDecisionTaskIds.filter(taskId => taskId !== id),
      taskHistory: (() => {
        const task = prev.tasks.find(t => t.id === id);
        if (!task) return prev.taskHistory;

        return [
          createHistoryEntry(id, task.title, "StatusChanged", `Status changed to ${status}`),
          ...prev.taskHistory,
        ].slice(0, 500);
      })(),
    }));
  };

  const dismissManualDecisionPrompt = (id: string) => {
    setState(prev => ({
      ...prev,
      manualDecisionTaskIds: prev.manualDecisionTaskIds.filter(taskId => taskId !== id),
    }));
  };

  const updateReminderSettings = (settings: Partial<ReminderSettings>) => {
    setState((prev) => ({
      ...prev,
      reminderSettings: {
        ...prev.reminderSettings,
        ...settings,
      },
    }));
  };

  const dismissNotification = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((notification) =>
        notification.id === id ? { ...notification, dismissed: true } : notification,
      ),
    }));
  };

  useEffect(() => {
    if (!state.user) return;

    const tick = () => {
      const now = new Date();
      const windowEnd = addMinutes(now, 2);
      const newNotifications: Notification[] = [];
      const newlyTriggeredKeys: string[] = [];

      for (const task of state.tasks) {
        if (task.status === "Completed" || task.status === "Missed") continue;

        const inAppReminders = Array.isArray(state.reminderSettings?.inAppReminders)
          ? state.reminderSettings.inAppReminders
          : DEFAULT_REMINDER_SETTINGS.inAppReminders;

        for (const timing of inAppReminders) {
          const reminderAt = getReminderDate(task.scheduledStart, timing);
          if (!reminderAt) continue;

          if (isBefore(reminderAt, now) || isAfter(reminderAt, windowEnd)) continue;

          const reminderKey = `${task.id}:${timing}`;
          if (state.triggeredReminderKeys.includes(reminderKey)) continue;

          const message = `Upcoming: ${task.title} (${reminderTimingLabel(timing)})`;
          newNotifications.push({
            id: generateId(),
            taskId: task.id,
            taskTitle: task.title,
            type: "reminder",
            reminderTiming: timing,
            message,
            scheduledFor: task.scheduledStart,
            createdAt: now.toISOString(),
            dismissed: false,
          });

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("Planify Reminder", {
              body: message,
            });
          }

          newlyTriggeredKeys.push(reminderKey);
        }
      }

      if (newNotifications.length === 0 && newlyTriggeredKeys.length === 0) return;

      setState((prev) => ({
        ...prev,
        notifications: [...newNotifications, ...prev.notifications].slice(0, 100),
        triggeredReminderKeys: [...new Set([...prev.triggeredReminderKeys, ...newlyTriggeredKeys])],
      }));
    };

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, [state.user, state.tasks, state.reminderSettings, state.triggeredReminderKeys]);

  const simulateMissedTask = (id: string, source: "manual" | "auto" = "manual") => {
    setState(prev => ({ ...prev, isProcessing: true, workflowStep: "Extracting" }));
    
    // Mark as missed
    updateTaskStatus(id, "Missed");

    setTimeout(() => {
      setState(prev => ({ ...prev, workflowStep: "Scheduling" }));
      
      setTimeout(() => {
        // Reschedule the missed task
        setState(prev => {
          const missedTask = prev.tasks.find(t => t.id === id);
          if (!missedTask) return prev;

          if (requiresManualDecision(missedTask)) {
            const alreadyQueued = prev.manualDecisionTaskIds.includes(id);
            return {
              ...prev,
              manualDecisionTaskIds: alreadyQueued ? prev.manualDecisionTaskIds : [id, ...prev.manualDecisionTaskIds],
              taskHistory: [
                createHistoryEntry(
                  id,
                  missedTask.title,
                  "ManualDecisionRequired",
                  "This task requires your decision and was not auto-rescheduled.",
                ),
                ...prev.taskHistory,
              ].slice(0, 500),
              workflowStep: "Done",
              isProcessing: false,
            };
          }

          // Create a new task based on the missed one
          const newTaskToSchedule = {
            title: missedTask.title,
            description: missedTask.description,
            priority: missedTask.priority,
            preferredStart: addMinutes(parseISO(missedTask.scheduledEnd), 15).toISOString(),
            deadline: missedTask.deadline,
            estimatedDurationMinutes: missedTask.estimatedDurationMinutes,
          };

          const minRescheduleStart = addMinutes(parseISO(missedTask.scheduledEnd), 15);
          const rescheduledTasks = scheduleTasks([newTaskToSchedule], prev.tasks, undefined, {
            ignoreTextTimeInference: true,
            minStartTime: minRescheduleStart,
            availabilityOverride: prev.availability,
          });

          if (rescheduledTasks.length === 0) {
            const alreadyQueued = prev.manualDecisionTaskIds.includes(id);
            return {
              ...prev,
              manualDecisionTaskIds: alreadyQueued ? prev.manualDecisionTaskIds : [id, ...prev.manualDecisionTaskIds],
              taskHistory: [
                createHistoryEntry(
                  id,
                  missedTask.title,
                  "ManualDecisionRequired",
                  "No slot matched your availability for auto-rescheduling.",
                ),
                ...prev.taskHistory,
              ].slice(0, 500),
              workflowStep: "Done",
              isProcessing: false,
            };
          }
          
          // Mark the newly scheduled task as "Rescheduled"
          const finalRescheduledTasks = rescheduledTasks.map(t => ({ ...t, status: "Rescheduled" as TaskStatus }));
          const rescheduledHistory = finalRescheduledTasks.map(task =>
            createHistoryEntry(
              task.id,
              task.title,
              "Rescheduled",
              source === "auto"
                ? `Auto-missed & rescheduled to ${format(parseISO(task.scheduledStart), "MMM d, h:mm a")}`
                : `Rescheduled to ${format(parseISO(task.scheduledStart), "MMM d, h:mm a")}`,
            ),
          );
          
          return {
            ...prev,
            tasks: [...prev.tasks, ...finalRescheduledTasks],
            taskHistory: [...rescheduledHistory, ...prev.taskHistory].slice(0, 500),
            workflowStep: "Done",
            isProcessing: false,
          };
        });

        setTimeout(() => {
          setState(prev => ({ ...prev, workflowStep: "Idle" }));
        }, 3000);
      }, 1500);
    }, 1000);
  };

  useEffect(() => {
    if (!state.user) return;
    if (state.isProcessing || state.workflowStep !== "Idle") return;

    const now = new Date();

    const overdueTask = [...state.tasks]
      .filter((task) => task.status === "Pending" || task.status === "Rescheduled")
      .sort((a, b) => parseISO(a.scheduledEnd).getTime() - parseISO(b.scheduledEnd).getTime())
      .find((task) => {
        const scheduledEnd = parseISO(task.scheduledEnd);
        const scheduledEndPassed = !Number.isNaN(scheduledEnd.getTime()) && scheduledEnd.getTime() <= now.getTime();

        let deadlinePassed = false;
        if (task.deadline) {
          const deadlineDate = parseISO(task.deadline);
          deadlinePassed = !Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() <= now.getTime();
        }

        return scheduledEndPassed || deadlinePassed;
      });

    if (!overdueTask) return;

    simulateMissedTask(overdueTask.id, "auto");
  }, [state.user, state.tasks, state.isProcessing, state.workflowStep]);

  return (
    <AppContext.Provider
      value={{
        state,
        addTask,
        updateTask,
        deleteTask,
        clearAllTasks,
        dismissManualDecisionPrompt,
        updateTaskStatus,
        processNewInput,
        simulateMissedTask,
        setWorkflowStep: (step) => setState(prev => ({ ...prev, workflowStep: step })),
        setIsProcessing: (isProcessing) => setState(prev => ({ ...prev, isProcessing })),
        setAvailability,
        updateReminderSettings,
        dismissNotification,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
