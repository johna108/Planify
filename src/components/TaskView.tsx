import React, { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { CheckCircle, Circle, Clock, AlertCircle, RefreshCw, Pencil, Trash2, X, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "motion/react";

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

type TaskDraft = {
  id: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  startDateTime: string;
  durationMinutes: number;
};

export function TaskView() {
  const { state, updateTaskStatus, simulateMissedTask, updateTask, deleteTask, clearAllTasks, dismissManualDecisionPrompt } = useAppContext();
  const [editingTask, setEditingTask] = useState<TaskDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const sortedTasks = useMemo(
    () => [...state.tasks].sort((a, b) => parseISO(a.scheduledStart).getTime() - parseISO(b.scheduledStart).getTime()),
    [state.tasks],
  );

  const manualDecisionTaskIdSet = useMemo(() => new Set(state.manualDecisionTaskIds), [state.manualDecisionTaskIds]);

  const openEditModal = (task: any) => {
    const start = parseISO(task.scheduledStart);
    const end = parseISO(task.scheduledEnd);
    const duration = Math.max(5, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));

    setEditingTask({
      id: task.id,
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      startDateTime: toLocalDateTimeInputValue(start),
      durationMinutes: duration,
    });
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingTask(null);
    setEditError(null);
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    if (!editingTask.title.trim()) {
      setEditError("Task title is required.");
      return;
    }

    if (editingTask.durationMinutes <= 0) {
      setEditError("Duration must be greater than 0 minutes.");
      return;
    }

    const start = new Date(editingTask.startDateTime);
    if (Number.isNaN(start.getTime())) {
      setEditError("Invalid start date/time.");
      return;
    }

    const end = new Date(start.getTime() + editingTask.durationMinutes * 60 * 1000);

    updateTask(editingTask.id, {
      title: editingTask.title.trim(),
      description: editingTask.description.trim(),
      priority: editingTask.priority,
      estimatedDurationMinutes: editingTask.durationMinutes,
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
    });

    closeEditModal();
  };

  const handleDeleteTask = (taskId: string) => {
    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;
    deleteTask(taskId);
  };

  const handleClearAllTasks = () => {
    if (state.tasks.length === 0) return;
    const confirmed = window.confirm(`Delete all ${state.tasks.length} tasks?`);
    if (!confirmed) return;
    clearAllTasks();
  };

  const handleTakeControl = (task: any) => {
    updateTaskStatus(task.id, "Pending");
    dismissManualDecisionPrompt(task.id);
    openEditModal(task);
  };

  const handleKeepMissed = (taskId: string) => {
    dismissManualDecisionPrompt(taskId);
  };

  const handleMarkDoneFromPrompt = (taskId: string) => {
    updateTaskStatus(taskId, "Completed");
    dismissManualDecisionPrompt(taskId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-700 border-red-200";
      case "Medium":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "Low":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <CheckCircle className="text-emerald-500" size={20} />;
      case "Missed":
        return <AlertCircle className="text-red-500" size={20} />;
      case "Rescheduled":
        return <RefreshCw className="text-amber-500" size={20} />;
      default:
        return <Circle className="text-slate-300 hover:text-indigo-500 transition-colors" size={20} />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
            <CheckCircle size={18} />
          </span>
          Active Tasks
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAllTasks}
            type="button"
            disabled={state.tasks.length === 0}
            className="text-xs font-medium bg-red-50 text-red-700 px-2.5 py-1 rounded-full flex items-center gap-1 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete all tasks"
          >
            <Trash2 size={12} />
            Delete all
          </button>
          <button
            onClick={() => setIsHistoryOpen(true)}
            type="button"
            className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full flex items-center gap-1 hover:bg-indigo-100"
          >
            <History size={12} />
            History
          </button>
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
            {state.tasks.filter((t) => t.status === "Pending" || t.status === "Rescheduled").length} Pending
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        <AnimatePresence>
          {state.tasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center"
            >
              <CheckCircle size={48} className="mb-4 opacity-20" />
              <p className="text-sm">No tasks scheduled yet.</p>
              <p className="text-xs mt-1">Paste some messy notes above to get started.</p>
            </motion.div>
          ) : (
            sortedTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`p-3 rounded-lg border transition-all ${
                    task.status === "Completed"
                      ? "bg-slate-50 border-slate-200 opacity-60"
                      : task.status === "Missed"
                      ? "bg-red-50 border-red-200"
                      : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() =>
                        updateTaskStatus(
                          task.id,
                          task.status === "Completed" ? "Pending" : "Completed"
                        )
                      }
                      className="mt-0.5 shrink-0 focus:outline-none"
                    >
                      {getStatusIcon(task.status)}
                    </button>
                    <div className="flex-1 min-w-0">
                      {manualDecisionTaskIdSet.has(task.id) && task.status === "Missed" && (
                        <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                          <p className="text-[11px] font-semibold text-amber-800">
                            Manual decision required: this task was not auto-rescheduled.
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTakeControl(task)}
                              className="text-[10px] font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-1 rounded"
                            >
                              Set new time
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkDoneFromPrompt(task.id)}
                              className="text-[10px] font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded"
                            >
                              Mark done
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-[10px] font-medium text-red-700 bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => handleKeepMissed(task.id)}
                              className="text-[10px] font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
                            >
                              Keep missed
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3
                          className={`text-sm font-medium truncate ${
                            task.status === "Completed" ? "line-through text-slate-500" : "text-slate-800"
                          }`}
                        >
                          {task.title}
                        </h3>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPriorityColor(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                          <Clock size={12} />
                          <span>
                            {format(parseISO(task.scheduledStart), "h:mm a")} -{" "}
                            {format(parseISO(task.scheduledEnd), "h:mm a")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(task)}
                            type="button"
                            className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors flex items-center gap-1"
                            title="Edit task"
                          >
                            <Pencil size={11} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            type="button"
                            className="text-[10px] font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors flex items-center gap-1"
                            title="Delete task"
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                          {(task.status === "Pending" || task.status === "Rescheduled") && (
                            <button
                              onClick={() => simulateMissedTask(task.id)}
                              type="button"
                              className="text-[10px] font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                              title="Simulate missing this task to trigger adaptive rescheduling"
                            >
                              Simulate Miss
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
          )}
        </AnimatePresence>
      </div>

      {editingTask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeEditModal} />
          <div className="relative w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Edit task</h3>
              <button onClick={closeEditModal} type="button" className="text-slate-500 hover:text-slate-700 p-1 rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitEdit} className="p-4 space-y-3">
              {editError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                <input
                  value={editingTask.title}
                  onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                  className="w-full min-h-[70px] px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, priority: e.target.value as "High" | "Medium" | "Low" } : prev))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={editingTask.durationMinutes}
                    onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, durationMinutes: Number(e.target.value) } : prev))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Start</label>
                <input
                  type="datetime-local"
                  value={editingTask.startDateTime}
                  onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, startDateTime: e.target.value } : prev))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-3 py-2 rounded-md border border-slate-300 text-slate-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
                >
                  Save task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isHistoryOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsHistoryOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-2xl max-h-[85vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} className="text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-800">Task History</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                type="button"
                className="text-slate-500 hover:text-slate-700 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(85vh-58px)] space-y-2">
              {state.taskHistory.length === 0 ? (
                <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                  No task history yet.
                </div>
              ) : (
                state.taskHistory.map((entry) => (
                  <div key={entry.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">{entry.taskTitle}</p>
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        {entry.action}
                      </span>
                    </div>
                    {entry.details && <p className="text-xs text-slate-600 mt-1">{entry.details}</p>}
                    <p className="text-[11px] text-slate-500 mt-1">{format(parseISO(entry.timestamp), "MMM d, yyyy • h:mm:ss a")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
