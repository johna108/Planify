import React from "react";
import { useAppContext } from "../context/AppContext";
import { FileText, Lightbulb } from "lucide-react";

export function SummaryView() {
  const { state } = useAppContext();

  if (!state.summary) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-stone-900">
        <span className="rounded-md bg-stone-100 p-1.5 text-stone-700">
          <FileText size={18} />
        </span>
        Summary
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-stone-700">
        {state.summary.text}
      </p>
      
      {state.summary.keyInsights.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <Lightbulb size={14} className="text-amber-600" />
            Key Insights
          </h3>
          <ul className="space-y-2">
            {state.summary.keyInsights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-0.5 text-amber-600">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
