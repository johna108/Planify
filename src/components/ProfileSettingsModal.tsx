import React, { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, User, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { DayAvailability, UserAvailability, useAppContext } from "../context/AppContext";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type DayKey = (typeof DAYS)[number];
type AvailabilityForm = Record<DayKey, DayAvailability>;

function createDefaultAvailability(): AvailabilityForm {
  return DAYS.reduce((acc, day) => {
    const isWeekend = day === "saturday" || day === "sunday";
    acc[day] = {
      enabled: !isWeekend,
      start: "09:00",
      end: "17:00",
    };
    return acc;
  }, {} as AvailabilityForm);
}

function normalizeAvailability(availability: UserAvailability | null): AvailabilityForm {
  const defaults = createDefaultAvailability();
  if (!availability) return defaults;

  const normalized = { ...defaults };
  for (const day of DAYS) {
    const dayValue = availability[day];
    if (dayValue) {
      normalized[day] = {
        enabled: Boolean(dayValue.enabled),
        start: dayValue.start || defaults[day].start,
        end: dayValue.end || defaults[day].end,
      };
    }
  }

  return normalized;
}

type ProfileSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
  const { state, setAvailability } = useAppContext();
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityForm>(createDefaultAvailability());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userEmail = useMemo(() => state.user?.email || "Signed-in user", [state.user?.email]);

  useEffect(() => {
    if (!isOpen) return;
    setAvailabilityForm(normalizeAvailability(state.availability));
    setError(null);
  }, [isOpen, state.availability]);

  if (!isOpen) return null;

  const handleDayChange = (day: DayKey, field: keyof DayAvailability, value: string | boolean) => {
    setAvailabilityForm((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleSetAllDay = (day: DayKey) => {
    setAvailabilityForm((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: true,
        start: "00:00",
        end: "23:59",
      },
    }));
  };

  const handleSave = async () => {
    if (!state.user) return;
    setIsSaving(true);
    setError(null);

    try {
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: state.user.id,
        availability: availabilityForm,
      });

      if (upsertError) throw upsertError;

      setAvailability(availabilityForm);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save profile settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden bg-white rounded-xl border border-slate-200 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
              <User size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Profile Settings</h3>
              <p className="text-xs text-slate-500">{userEmail}</p>
            </div>
          </div>
          <button onClick={onClose} type="button" className="text-slate-500 hover:text-slate-700 p-1 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-132px)]">
          <div className="flex items-center gap-2 mb-4 text-slate-700">
            <Clock size={16} />
            <h4 className="text-sm font-semibold">Weekly Availability</h4>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-3">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3 min-w-[160px]">
                  <input
                    type="checkbox"
                    checked={availabilityForm[day].enabled}
                    onChange={(e) => handleDayChange(day, "enabled", e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700 capitalize">{day}</span>
                </div>

                <div className="flex items-center gap-3">
                  {availabilityForm[day].enabled ? (
                    <>
                      <input
                        type="time"
                        value={availabilityForm[day].start}
                        onChange={(e) => handleDayChange(day, "start", e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="text-slate-500 text-sm">to</span>
                      <input
                        type="time"
                        value={availabilityForm[day].end}
                        onChange={(e) => handleDayChange(day, "end", e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSetAllDay(day)}
                        className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        All Day
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 italic">Unavailable</span>
                      <button
                        type="button"
                        onClick={() => handleSetAllDay(day)}
                        className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        All Day
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 bg-white">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            type="button"
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60 flex items-center gap-2"
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
