import React, { createContext, useContext, useState, useEffect } from "react";
import { addMinutes, isBefore, isAfter, parseISO, format, startOfDay, endOfDay, addDays } from "date-fns";
import { ExtractedTask } from "../services/ai";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";

export type TaskStatus = "Pending" | "Completed" | "Missed" | "Rescheduled";

export type DayAvailability = {
  enabled: boolean;
  start: string;
  end: string;
};

export type UserAvailability = {
  [key: string]: DayAvailability;
};

export type ScheduledTask = ExtractedTask & {
  scheduledStart: string; // ISO string
  scheduledEnd: string; // ISO string
  status: TaskStatus;
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

type AppState = {
  tasks: ScheduledTask[];
  taskHistory: TaskHistoryEntry[];
  manualDecisionTaskIds: string[];
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
  simulateMissedTask: (id: string) => void;
  setWorkflowStep: (step: AppState["workflowStep"]) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setAvailability: (availability: UserAvailability) => void;
  signOut: () => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const APP_STORAGE_KEY = "planify_app_state_v1";

type PersistedAppState = {
  tasks: ScheduledTask[];
  taskHistory: TaskHistoryEntry[];
  manualDecisionTaskIds: string[];
  summary: SummaryData | null;
};

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
      summary: state.summary,
    };

    try {
      window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      return;
    }
  }, [state.tasks, state.taskHistory, state.manualDecisionTaskIds, state.summary]);

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
    
    // Check if we're coming back from OAuth callback (hash contains session)
    if (window.location.hash) {
      console.log('[AppContext] Hash detected:', window.location.hash.substring(0, 50) + '...');
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AppContext] Initial session:', session?.user?.email ? `${session.user.email}` : 'null');
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
    const timeMatch = normalized.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!timeMatch) return null;

    const rawHour = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || "0");
    const meridiem = timeMatch[3].toLowerCase();

    if (!Number.isFinite(rawHour) || rawHour < 1 || rawHour > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    let hour = rawHour % 12;
    if (meridiem === "pm") {
      hour += 12;
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
    const inferredFromTask = inferPreferredStartFromText(taskText, baseNow);
    if (inferredFromTask) return inferredFromTask;

    if (rawInput) {
      const inferredFromInput = inferPreferredStartFromText(rawInput, baseNow);
      if (inferredFromInput) return inferredFromInput;
    }

    const explicit = resolvePreferredStart(task);
    if (explicit) return explicit;

    return null;
  };

  type ScheduleOptions = {
    ignoreTextTimeInference?: boolean;
    minStartTime?: Date;
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
  const scheduleTasks = (
    newTasks: Omit<ExtractedTask, "id">[],
    existingTasks: ScheduledTask[],
    rawInput?: string,
    options?: ScheduleOptions,
  ): ScheduledTask[] => {
    const currentTime = roundToNextQuarterHour(new Date());
    const minStartTime = options?.minStartTime
      ? roundToNextQuarterHour(options.minStartTime)
      : currentTime;

    const scheduled: ScheduledTask[] = [];
    let currentSlot = currentTime;

    // Sort new tasks by priority (High > Medium > Low) and deadline
    const sortedTasks = [...newTasks].sort((a, b) => {
      const aPreferredStart = resolveTaskPreferredStartWithOptions(a, rawInput, currentTime, options);
      const bPreferredStart = resolveTaskPreferredStartWithOptions(b, rawInput, currentTime, options);

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
      const preferredStart = resolveTaskPreferredStartWithOptions(task, rawInput, currentTime, options);
      const initialSlot = preferredStart
        ? roundToNextQuarterHour(preferredStart)
        : currentSlot;
      let taskSlot = initialSlot;
      while (isBefore(taskSlot, currentTime) && preferredStart) {
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
        
        // Use user availability if set, otherwise default 9-6
        const dayOfWeek = format(taskSlot, 'EEEE').toLowerCase();
        const dayConfig = state.availability ? state.availability[dayOfWeek] : { enabled: true, start: '09:00', end: '18:00' };

        if (!dayConfig || !dayConfig.enabled) {
          // Move to next day at 00:00
          taskSlot = startOfDay(addDays(taskSlot, 1));
          continue;
        }

        const [startHour, startMinute] = dayConfig.start.split(':').map(Number);
        const [endHour, endMinute] = dayConfig.end.split(':').map(Number);

        const dayStart = new Date(taskSlot);
        dayStart.setHours(startHour, startMinute, 0, 0);

        const dayEnd = new Date(taskSlot);
        dayEnd.setHours(endHour, endMinute, 0, 0);

        if (taskSlot >= dayEnd) {
          taskSlot = startOfDay(addDays(taskSlot, 1));
          continue;
        } else if (taskSlot < dayStart) {
          taskSlot = dayStart;
        }

        const duration = task.estimatedDurationMinutes || 30;
        const proposedEnd = addMinutes(taskSlot, duration);

        // Check if proposed end exceeds day end
        if (proposedEnd > dayEnd) {
          taskSlot = startOfDay(addDays(taskSlot, 1));
          continue;
        }

        // Check for conflicts with existing tasks and newly scheduled tasks
        const allTasks = [...existingTasks, ...scheduled];
        const hasConflict = allTasks.some(t => {
          if (t.status === "Completed" || t.status === "Missed") return false;
          const tStart = parseISO(t.scheduledStart);
          const tEnd = parseISO(t.scheduledEnd);
          return (
            (isAfter(taskSlot, tStart) && isBefore(taskSlot, tEnd)) ||
            (isAfter(proposedEnd, tStart) && isBefore(proposedEnd, tEnd)) ||
            (isBefore(taskSlot, tStart) && isAfter(proposedEnd, tEnd)) ||
            taskSlot.getTime() === tStart.getTime()
          );
        });

        if (!hasConflict) {
          scheduled.push({
            ...task,
            id: Math.random().toString(36).substring(7),
            scheduledStart: taskSlot.toISOString(),
            scheduledEnd: proposedEnd.toISOString(),
            status: "Pending",
          });
          currentSlot = isAfter(proposedEnd, currentSlot) ? proposedEnd : currentSlot;
          foundSlot = true;
        } else {
          taskSlot = addMinutes(taskSlot, 15); // Try next 15 min slot
        }
      }
    }

    return scheduled;
  };

  const processNewInput = (input: string, extractedData: any) => {
    setState(prev => ({ ...prev, workflowStep: "Scheduling" }));
    
    setTimeout(() => {
      const now = new Date();
      const normalizedTasks = (extractedData.tasks || []).map((task: Omit<ExtractedTask, "id">) => {
        if (task.preferredStart) return task;
        const inferred = resolveTaskPreferredStart(task, input, now);
        if (!inferred) return task;

        return {
          ...task,
          preferredStart: inferred.toISOString(),
        };
      });

      const newScheduledTasks = scheduleTasks(normalizedTasks, state.tasks, input);
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
        summary: extractedData.summary,
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

  const simulateMissedTask = (id: string) => {
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
          });
          
          // Mark the newly scheduled task as "Rescheduled"
          const finalRescheduledTasks = rescheduledTasks.map(t => ({ ...t, status: "Rescheduled" as TaskStatus }));
          const rescheduledHistory = finalRescheduledTasks.map(task =>
            createHistoryEntry(
              task.id,
              task.title,
              "Rescheduled",
              `Rescheduled to ${format(parseISO(task.scheduledStart), "MMM d, h:mm a")}`,
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
