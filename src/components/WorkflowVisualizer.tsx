import React from "react";
import { useAppContext } from "../context/AppContext";
import { motion } from "motion/react";
import { BrainCircuit, FileSearch, CalendarClock, CheckCircle2 } from "lucide-react";

export function WorkflowVisualizer() {
  const { state } = useAppContext();

  const steps = [
    { id: "Idle", label: "Awaiting Input", shortLabel: "Input", icon: BrainCircuit },
    { id: "Extracting", label: "AI Extraction", shortLabel: "Extract", icon: FileSearch },
    { id: "Scheduling", label: "Task Scheduling", shortLabel: "Schedule", icon: CalendarClock },
    { id: "Done", label: "Executed", shortLabel: "Done", icon: CheckCircle2 },
  ];

  const currentStepIndex = Math.max(0, steps.findIndex((s) => s.id === state.workflowStep));

  return (
    <div className="rounded-xl border border-stone-800 bg-black p-5 text-white">
      <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-300">
        <BrainCircuit size={15} className="text-amber-400" />
        Workflow State
      </h2>

      <div className="relative grid grid-cols-4 gap-2">
        <div className="absolute left-[12.5%] right-[12.5%] top-6 z-0 h-1 -translate-y-1/2 rounded-full bg-stone-800"></div>

        <motion.div
          className="absolute left-[12.5%] top-6 z-0 h-1 -translate-y-1/2 rounded-full bg-amber-500"
          initial={{ width: "0%" }}
          animate={{
            width: `${(currentStepIndex / (steps.length - 1)) * 75}%`,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isPast = index < currentStepIndex;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex min-w-0 flex-col items-center gap-2 text-center">
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  isActive
                    ? "border-amber-500 bg-amber-500 text-white"
                    : isPast
                    ? "border-amber-500 bg-amber-500/20 text-amber-300"
                    : "border-stone-700 bg-stone-900 text-stone-400"
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
                className={`min-h-[2.25rem] px-1 text-[10px] font-medium leading-tight sm:text-xs ${
                  isActive ? "text-white" : isPast ? "text-stone-200" : "text-stone-400"
                }`}
              >
                <span className="sm:hidden">{step.shortLabel}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
