import React, { useEffect, useMemo, useState } from "react";
import { Bell, Copy, Loader2, Plus, Trash2, User, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { ReminderSettings, ReminderTiming, UserAvailability, useAppContext } from "../context/AppContext";
import { PopoverSelect } from "./PopoverSelect";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type DayKey = (typeof DAYS)[number];
type TimeSlot = { start: string; end: string };
type AvailabilityForm = Record<DayKey, TimeSlot[]>;
type SelectedDays = Record<DayKey, boolean>;

const DAY_SHORT: Record<DayKey, string> = {
  monday: "M",
  tuesday: "T",
  wednesday: "W",
  thursday: "T",
  friday: "F",
  saturday: "S",
  sunday: "S",
};

const DAY_LABEL: Record<DayKey, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

const TIME_OPTIONS = [
  "00:00",
  "01:00",
  "02:00",
  "03:00",
  "04:00",
  "05:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
  "24:00",
] as const;

const TIME_SELECT_OPTIONS = TIME_OPTIONS.map((time) => ({ label: time, value: time }));

const TIME_ZONES = [
  { label: "Asia/Calcutta (GMT+5:30)", value: "Asia/Calcutta" },
  { label: "UTC (GMT+0)", value: "UTC" },
  { label: "America/New_York (GMT-5)", value: "America/New_York" },
  { label: "Europe/London (GMT+0)", value: "Europe/London" },
];

const toStoredTime = (time: string) => (time === "24:00" ? "23:59" : time);
const fromStoredTime = (time: string) => (time === "23:59" ? "24:00" : time);
const DEFAULT_SLOT: TimeSlot = { start: "09:00", end: "17:00" };
const EMPTY_SLOT: TimeSlot = { start: "", end: "" };

const timeToMinutes = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  if (hour === 23 && minute === 59) return 24 * 60;
  return hour * 60 + minute;
};

const isCompleteSlot = (slot: TimeSlot) => slot.start !== "" && slot.end !== "";

const isValidSlot = (slot: TimeSlot) => timeToMinutes(slot.start) < timeToMinutes(slot.end);

const slotsOverlap = (first: TimeSlot, second: TimeSlot) => {
  const firstStart = timeToMinutes(first.start);
  const firstEnd = timeToMinutes(first.end);
  const secondStart = timeToMinutes(second.start);
  const secondEnd = timeToMinutes(second.end);
  return firstStart < secondEnd && secondStart < firstEnd;
};

const hasOverlapAtIndex = (slots: TimeSlot[], slotIndex: number, candidate: TimeSlot) => {
  if (!isCompleteSlot(candidate)) {
    return false;
  }

  for (let index = 0; index < slots.length; index++) {
    if (index === slotIndex) continue;
    if (!isCompleteSlot(slots[index])) continue;
    if (slotsOverlap(candidate, slots[index])) {
      return true;
    }
  }
  return false;
};

const REMINDER_TIMINGS: Array<{ value: ReminderTiming; label: string }> = [
  { value: "1_day_before", label: "1 day before" },
  { value: "1_hour_before", label: "1 hour before" },
  { value: "15_min_before", label: "15 minutes before" },
  { value: "5_min_before", label: "5 minutes before" },
  { value: "at_time", label: "At task time" },
];

function createDefaultAvailability(): AvailabilityForm {
  return DAYS.reduce((acc, day) => {
    const isWeekend = day === "saturday" || day === "sunday";
    acc[day] = isWeekend ? [] : [{ start: "09:00", end: "17:00" }];
    return acc;
  }, {} as AvailabilityForm);
}

function createSelectedDays(availability: AvailabilityForm): SelectedDays {
  return DAYS.reduce((acc, day) => {
    acc[day] = availability[day].length > 0;
    return acc;
  }, {} as SelectedDays);
}

function normalizeAvailability(availability: UserAvailability | null): AvailabilityForm {
  const defaults = createDefaultAvailability();
  if (!availability) return defaults;

  const normalized = { ...defaults };
  for (const day of DAYS) {
    const dayValue = availability[day] as any;
    if (!dayValue) continue;

    if (Array.isArray(dayValue)) {
      normalized[day] = dayValue
        .filter((slot) => slot && typeof slot.start === "string" && typeof slot.end === "string")
        .map((slot) => ({ start: slot.start, end: slot.end }));
      continue;
    }

    if (Array.isArray(dayValue.slots)) {
      normalized[day] = dayValue.slots
        .filter((slot: any) => slot && typeof slot.start === "string" && typeof slot.end === "string")
        .map((slot: any) => ({ start: slot.start, end: slot.end }));
      continue;
    }

    if (typeof dayValue === "object") {
      const enabled = Boolean(dayValue.enabled);
      if (enabled && typeof dayValue.start === "string" && typeof dayValue.end === "string") {
        normalized[day] = [{ start: dayValue.start, end: dayValue.end }];
      } else {
        normalized[day] = [];
      }
    }
  }

  return normalized;
}

type ProfileSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
  const { state, setAvailability, updateReminderSettings } = useAppContext();
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityForm>(createDefaultAvailability());
  const [selectedDays, setSelectedDays] = useState<SelectedDays>(createSelectedDays(createDefaultAvailability()));
  const [copySourceDay, setCopySourceDay] = useState<DayKey | null>(null);
  const [copySelections, setCopySelections] = useState<SelectedDays>(createSelectedDays(createDefaultAvailability()));
  const [reminderForm, setReminderForm] = useState<ReminderSettings>(state.reminderSettings);
  const [selectedTimeZone, setSelectedTimeZone] = useState("Asia/Calcutta");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userEmail = useMemo(() => state.user?.email || "Signed-in user", [state.user?.email]);

  useEffect(() => {
    if (!isOpen) return;
    const normalized = normalizeAvailability(state.availability);
    setAvailabilityForm(normalized);
    setSelectedDays(createSelectedDays(normalized));
    setCopySourceDay(null);
    setReminderForm(state.reminderSettings);
    setError(null);
  }, [isOpen, state.availability, state.reminderSettings]);

  if (!isOpen) return null;

  const handleToggleDay = (day: DayKey) => {
    setSelectedDays((prev) => {
      const nextSelected = !prev[day];
      if (nextSelected && availabilityForm[day].length === 0) {
        setAvailabilityForm((prevSlots) => ({
          ...prevSlots,
          [day]: [DEFAULT_SLOT],
        }));
      }

      return {
        ...prev,
        [day]: nextSelected,
      };
    });
  };

  const handleSlotChange = (day: DayKey, slotIndex: number, field: "start" | "end", value: string) => {
    const stored = value === "" ? "" : toStoredTime(value);
    setAvailabilityForm((prev) => {
      const daySlots = prev[day];
      const candidate = {
        ...daySlots[slotIndex],
        [field]: stored,
      };

      if (isCompleteSlot(candidate)) {
        if (!isValidSlot(candidate)) {
          setError("Start time must be before end time.");
          return prev;
        }

        if (hasOverlapAtIndex(daySlots, slotIndex, candidate)) {
          setError("Time slots cannot overlap on the same day.");
          return prev;
        }
      }

      setError(null);
      const nextDaySlots = daySlots.map((slot, index) => (index === slotIndex ? candidate : slot));
      const updated = {
        ...prev,
        [day]: nextDaySlots,
      };

      return updated;
    });
  };

  const addSlot = (day: DayKey, slotIndex: number) => {
    setAvailabilityForm((prev) => {
      setError(null);
      const current = prev[day];
      const next = [...current];
      next.splice(slotIndex + 1, 0, { ...EMPTY_SLOT });

      return {
        ...prev,
        [day]: next,
      };
    });
  };

  const deleteSlot = (day: DayKey, slotIndex: number) => {
    if (slotIndex === 0) return;

    setAvailabilityForm((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, index) => index !== slotIndex),
    }));
  };

  const openCopyMenu = (sourceDay: DayKey) => {
    setCopySourceDay(sourceDay);
    setCopySelections(
      DAYS.reduce((acc, day) => {
        acc[day] = day === sourceDay;
        return acc;
      }, {} as SelectedDays),
    );
  };

  const toggleCopyAll = (checked: boolean) => {
    if (!copySourceDay) return;

    setCopySelections(
      DAYS.reduce((acc, day) => {
        acc[day] = checked || day === copySourceDay;
        return acc;
      }, {} as SelectedDays),
    );
  };

  const toggleCopyDay = (day: DayKey, checked: boolean) => {
    if (!copySourceDay || day === copySourceDay) return;
    setCopySelections((prev) => ({
      ...prev,
      [day]: checked,
    }));
  };

  const applyCopySelections = () => {
    if (!copySourceDay) return;

    setAvailabilityForm((prev) => {
      const source = prev[copySourceDay].map((slot) => ({ ...slot }));
      const next = { ...prev };

      for (const day of DAYS) {
        if (!copySelections[day]) continue;
        next[day] = source.map((slot) => ({ ...slot }));
      }

      setError(null);
      return next;
    });

    setCopySourceDay(null);
  };

  const toggleTiming = (timing: ReminderTiming) => {
    setReminderForm((prev) => {
      const current = prev.inAppReminders;
      const exists = current.includes(timing);
      const next = exists ? current.filter((item) => item !== timing) : [...current, timing];
      return {
        ...prev,
        inAppReminders: next,
      };
    });
  };

  const handleSave = async () => {
    if (!state.user) return;
    setIsSaving(true);
    setError(null);

    try {
      const payload = DAYS.reduce((acc, day) => {
        acc[day] = selectedDays[day] ? availabilityForm[day] : [];
        return acc;
      }, {} as AvailabilityForm);

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: state.user.id,
        availability: payload,
      });

      if (upsertError) throw upsertError;

      setAvailability(payload);
      updateReminderSettings(reminderForm);
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
          <div className="space-y-5">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">Time zone</h4>
              <p className="text-sm text-slate-500 mt-1">Select your time zone to display availability</p>
              <div className="mt-3 max-w-sm">
                <PopoverSelect
                  value={selectedTimeZone}
                  onChange={(value) => setSelectedTimeZone(value)}
                  options={TIME_ZONES}
                  triggerClassName="bg-slate-50 py-2.5"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4">
              <h4 className="text-2xl font-semibold text-slate-900">Working hours & days</h4>
              <p className="text-sm text-slate-500 mt-1">We'll use your selected time zone to display availability</p>
              <p className="text-base text-slate-900 mt-4">Let's start with your usual working hours. You can update anytime as needed.</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const isActive = selectedDays[day];
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`h-8 min-w-8 px-3 rounded-full text-xs font-semibold border transition ${
                        isActive
                          ? "bg-black text-white border-black"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {DAY_SHORT[day]}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                {DAYS
                  .filter((day) => selectedDays[day])
                  .map((day) =>
                    availabilityForm[day].map((slot, slotIndex) => {
                      const isCopyMenuOpen = copySourceDay === day && slotIndex === 0;
                      const isAllChecked = DAYS.every((dayKey) => copySelections[dayKey]);

                      return (
                      <div key={`${day}-${slotIndex}`} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-lg text-slate-900 capitalize md:w-[140px] shrink-0">{slotIndex === 0 ? day : ""}</div>

                          <div className="flex items-center gap-2">
                            <PopoverSelect
                              value={fromStoredTime(slot.start)}
                              onChange={(value) => handleSlotChange(day, slotIndex, "start", value)}
                              options={TIME_SELECT_OPTIONS}
                              placeholder="Select"
                              className="min-w-[120px]"
                            />
                            <span className="text-sm text-slate-700">to</span>
                            <PopoverSelect
                              value={fromStoredTime(slot.end)}
                              onChange={(value) => handleSlotChange(day, slotIndex, "end", value)}
                              options={TIME_SELECT_OPTIONS}
                              placeholder="Select"
                              className="min-w-[120px]"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            {slotIndex === 0 ? (
                              <>
                                {availabilityForm[day].length === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => addSlot(day, slotIndex)}
                                    className="h-9 w-9 rounded-full border border-slate-300 bg-slate-100 text-slate-700 inline-flex items-center justify-center"
                                    title="Add slot for this day"
                                  >
                                    <Plus size={14} />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => openCopyMenu(day)}
                                  className="h-9 px-4 rounded-full border border-slate-300 bg-slate-100 text-sm font-medium text-slate-800 inline-flex items-center gap-1.5"
                                  title="Copy this day to selected days"
                                >
                                  <Copy size={13} />
                                  Copy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => addSlot(day, slotIndex)}
                                  className="h-9 w-9 rounded-full border border-slate-300 bg-slate-100 text-slate-700 inline-flex items-center justify-center"
                                  title="Add slot for this day"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSlot(day, slotIndex)}
                                  className="h-9 w-9 rounded-full border border-red-200 bg-red-50 text-red-600 inline-flex items-center justify-center"
                                  title="Delete this slot"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isCopyMenuOpen && (
                          <div className="md:ml-[140px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isAllChecked}
                                  onChange={(e) => toggleCopyAll(e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                All
                              </label>
                              {DAYS.map((dayKey) => {
                                const isSourceDay = dayKey === copySourceDay;
                                return (
                                  <label key={`copy-${dayKey}`} className={`flex items-center gap-2 ${isSourceDay ? "text-slate-400" : ""}`}>
                                    <input
                                      type="checkbox"
                                      checked={copySelections[dayKey]}
                                      disabled={isSourceDay}
                                      onChange={(e) => toggleCopyDay(dayKey, e.target.checked)}
                                      className="h-4 w-4 rounded border-slate-300"
                                    />
                                    {DAY_LABEL[dayKey]}
                                  </label>
                                );
                              })}
                            </div>

                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setCopySourceDay(null)}
                                className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={applyCopySelections}
                                className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }),
                  )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3 text-slate-700">
              <Bell size={16} />
              <h4 className="text-sm font-semibold">In-app Notifications</h4>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">Alert timings</p>
              <div className="space-y-1.5">
                {REMINDER_TIMINGS.map((timing) => (
                  <label key={`inapp-${timing.value}`} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={reminderForm.inAppReminders.includes(timing.value)}
                      onChange={() => toggleTiming(timing.value)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                    />
                    {timing.label}
                  </label>
                ))}
              </div>
            </div>
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
