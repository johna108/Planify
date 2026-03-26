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
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-stone-900">
        <span className="rounded-md bg-stone-100 p-1.5 text-stone-700">
          <Send size={18} />
        </span>
        Add tasks
      </h2>
      <p className="mb-3 text-xs text-stone-500">Paste notes or type tasks in plain language.</p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Example: Submit assignment Friday 5pm, call Alex tomorrow, review chapter 3"
          className="min-h-[120px] w-full resize-none rounded-lg border border-stone-300 p-3 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          disabled={state.isProcessing}
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={!input.trim() || state.isProcessing}
            className="flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Process
                <Send size={16} />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 border-t border-stone-200 pt-4">
        <button
          type="button"
          onClick={() => setShowManualForm((prev) => !prev)}
          className="flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-stone-900"
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
              <label className="mb-1 block text-xs font-semibold text-stone-600">Task title</label>
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g., Prepare slides"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">Description</label>
              <textarea
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="Optional details"
                className="min-h-[72px] w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600">Priority</label>
                <select
                  value={manualPriority}
                  onChange={(e) => setManualPriority(e.target.value as "High" | "Medium" | "Low")}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600">Duration (minutes)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={manualDuration}
                  onChange={(e) => setManualDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">Start date & time</label>
              <div className="relative">
                <CalendarClock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="datetime-local"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
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
