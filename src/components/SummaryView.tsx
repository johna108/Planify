import React from "react";
import { useAppContext } from "../context/AppContext";
import { FileText, Lightbulb } from "lucide-react";

export function SummaryView() {
  const { state } = useAppContext();

  if (!state.summary) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
          <FileText size={18} />
        </span>
        AI Summary
      </h2>
      <p className="text-sm text-slate-600 mb-4 leading-relaxed">
        {state.summary.text}
      </p>
      
      {state.summary.keyInsights.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Lightbulb size={14} className="text-amber-500" />
            Key Insights
          </h3>
          <ul className="space-y-2">
            {state.summary.keyInsights.map((insight, idx) => (
              <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
