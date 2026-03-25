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

  const currentStepIndex = steps.findIndex((s) => s.id === state.workflowStep);

  return (
    <div className="bg-slate-900 rounded-xl shadow-lg p-6 text-white border border-slate-800">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
        <BrainCircuit size={16} className="text-indigo-400" />
       Adaptive AI Engine
      </h2>

      <div className="flex items-center justify-between relative">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 -translate-y-1/2 rounded-full z-0"></div>

        {/* Active Line Progress */}
        <motion.div
          className="absolute top-1/2 left-0 h-1 bg-indigo-500 -translate-y-1/2 rounded-full z-0"
          initial={{ width: "0%" }}
          animate={{
            width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        ></motion.div>

        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isPast = index < currentStepIndex;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  isActive
                    ? "bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    : isPast
                    ? "bg-slate-800 border-indigo-500 text-indigo-400"
                    : "bg-slate-800 border-slate-700 text-slate-500"
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
                  isActive ? "text-indigo-300" : isPast ? "text-slate-400" : "text-slate-600"
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
