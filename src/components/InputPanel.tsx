import React, { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { processInput } from "../services/ai";
import { Send, Loader2, PlusCircle, CalendarClock } from "lucide-react";

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

export function InputPanel() {
  const [input, setInput] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualPriority, setManualPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [manualStart, setManualStart] = useState(toLocalDateTimeInputValue(new Date()));
  const [manualDuration, setManualDuration] = useState(60);
  const [manualError, setManualError] = useState<string | null>(null);

  const { state, setWorkflowStep, setIsProcessing, processNewInput, addTask } = useAppContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || state.isProcessing) return;

    setIsProcessing(true);
    setWorkflowStep("Extracting");

    try {
      const currentTime = new Date().toISOString();
      const extractedData = await processInput(input, currentTime);
      processNewInput(input, extractedData);
      setInput("");
    } catch (error) {
      console.error("Failed to process input:", error);
      setIsProcessing(false);
      setWorkflowStep("Idle");
      // Optionally show an error toast here
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    if (!manualTitle.trim()) {
      setManualError("Task title is required.");
      return;
    }

    if (!manualStart) {
      setManualError("Start date/time is required.");
      return;
    }

    if (!Number.isFinite(manualDuration) || manualDuration <= 0) {
      setManualError("Duration must be greater than 0 minutes.");
      return;
    }

    const startDate = new Date(manualStart);
    if (Number.isNaN(startDate.getTime())) {
      setManualError("Invalid start date/time.");
      return;
    }

    const endDate = new Date(startDate.getTime() + manualDuration * 60 * 1000);

    addTask({
      title: manualTitle.trim(),
      description: manualDescription.trim() || "Manual task",
      priority: manualPriority,
      estimatedDurationMinutes: manualDuration,
      scheduledStart: startDate.toISOString(),
      scheduledEnd: endDate.toISOString(),
      status: "Pending",
    });

    setManualTitle("");
    setManualDescription("");
    setManualPriority("Medium");
    setManualStart(toLocalDateTimeInputValue(new Date()));
    setManualDuration(60);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
          <Send size={18} />
        </span>
        Smart Input
      </h2>
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste messy notes, chat logs, or tasks here... e.g., 'Assignment due Friday, meeting at 5 PM, study ML chapter 3'"
          className="w-full min-h-[120px] p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm text-slate-700 placeholder:text-slate-400"
          disabled={state.isProcessing}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <button
            type="submit"
            disabled={!input.trim() || state.isProcessing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {state.isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Execute
                <Send size={16} />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setShowManualForm((prev) => !prev)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
        >
          <PlusCircle size={16} />
          {showManualForm ? "Hide manual task form" : "Add task manually"}
        </button>

        {showManualForm && (
          <form onSubmit={handleManualSubmit} className="mt-3 space-y-3">
            {manualError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {manualError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Task title</label>
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g., Prepare slides"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <textarea
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="Optional details"
                className="w-full min-h-[72px] px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                <select
                  value={manualPriority}
                  onChange={(e) => setManualPriority(e.target.value as "High" | "Medium" | "Low")}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={manualDuration}
                  onChange={(e) => setManualDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start date & time</label>
              <div className="relative">
                <CalendarClock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Add Task
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
