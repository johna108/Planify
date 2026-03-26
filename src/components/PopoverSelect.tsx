import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type PopoverOption = {
  label: string;
  value: string;
};

type PopoverSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: PopoverOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
};

export function PopoverSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled = false,
  className = "",
  triggerClassName = "",
  panelClassName = "",
}: PopoverSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleOptionClick = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`w-full min-w-[120px] rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 inline-flex items-center justify-between gap-2 disabled:opacity-50 ${triggerClassName}`}
      >
        <span className={selected ? "" : "text-slate-500"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className={`absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[140px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg ${panelClassName}`}
        >
          <div className="max-h-56 overflow-y-auto">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOptionClick(option.value)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                    active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
