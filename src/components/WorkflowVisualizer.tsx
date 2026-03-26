import React from "react";
import { useAppContext } from "../context/AppContext";
import { motion } from "motion/react";
import { BrainCircuit, FileSearch, CalendarClock, CheckCircle2 } from "lucide-react";

export function WorkflowVisualizer() {
  const { state } = useAppContext();

  const steps = [
    { id: "Idle", label: "Awaiting Input", icon: BrainCircuit },
    { id: "Extracting", label: "AI Extraction", icon: FileSearch },
    { id: "Scheduling", label: "Task Scheduling", icon: CalendarClock },
    { id: "Done", label: "Executed", icon: CheckCircle2 },
  ];

  const currentStepIndex = Math.max(0, steps.findIndex((s) => s.id === state.workflowStep));

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
      <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
        <BrainCircuit size={15} className="text-amber-600" />
        Workflow State
      </h2>

      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 z-0 h-1 w-full -translate-y-1/2 rounded-full bg-stone-200"></div>

        <motion.div
          className="absolute top-1/2 left-0 z-0 h-1 -translate-y-1/2 rounded-full bg-amber-500"
          initial={{ width: "0%" }}
          animate={{
            width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isPast = index < currentStepIndex;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  isActive
                    ? "border-amber-500 bg-amber-500 text-white"
                    : isPast
                    ? "border-amber-300 bg-amber-100 text-amber-700"
                    : "border-stone-300 bg-white text-stone-400"
                }`}
                animate={
                  isActive
                    ? { scale: [1, 1.1, 1], transition: { repeat: Infinity, duration: 2 } }
                    : { scale: 1 }
                }
              >
                <Icon size={20} />
              </motion.div>
              <span
                className={`text-xs font-medium ${
                  isActive ? "text-stone-900" : isPast ? "text-stone-700" : "text-stone-500"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
