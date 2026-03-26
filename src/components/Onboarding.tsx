import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Clock, Copy, Plus, Trash2 } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { PopoverSelect } from "./PopoverSelect";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type DayKey = (typeof DAYS)[number];
type TimeSlot = { start: string; end: string };
type AvailabilityForm = Record<DayKey, TimeSlot[]>;
type SelectedDays = Record<DayKey, boolean>;

const DAY_SHORT: Record<DayKey, string> = {
  sunday: "S",
  monday: "M",
  tuesday: "T",
  wednesday: "W",
  thursday: "T",
  friday: "F",
  saturday: "S",
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

const createDefaultAvailability = (): AvailabilityForm => ({
  sunday: [{ start: "09:00", end: "23:59" }],
  monday: [{ start: "17:00", end: "23:59" }],
  tuesday: [{ start: "17:00", end: "23:59" }],
  wednesday: [{ start: "17:00", end: "23:59" }],
  thursday: [{ start: "17:00", end: "23:59" }],
  friday: [{ start: "17:00", end: "23:59" }],
  saturday: [{ start: "17:00", end: "23:59" }],
});

const createDefaultSelectedDays = (): SelectedDays => ({
  sunday: true,
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: true,
});

export function Onboarding() {
  const { state, setAvailability } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeZone, setSelectedTimeZone] = useState("Asia/Calcutta");
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityForm>(createDefaultAvailability());
  const [selectedDays, setSelectedDays] = useState<SelectedDays>(createDefaultSelectedDays());
  const [copySourceDay, setCopySourceDay] = useState<DayKey | null>(null);
  const [copySelections, setCopySelections] = useState<SelectedDays>(createDefaultSelectedDays());

  const orderedRows = useMemo(() => DAYS, []);

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
    setAvailabilityForm((prev) => {
      if (slotIndex === 0) return prev;

      const nextDaySlots = prev[day].filter((_, index) => index !== slotIndex);
      return {
        ...prev,
        [day]: nextDaySlots,
      };
    });
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

  const handleSave = async () => {
    if (!state.user) return;
    setLoading(true);
    setError(null);

    try {
      const payload = DAYS.reduce((acc, day) => {
        acc[day] = selectedDays[day] ? availabilityForm[day] : [];
        return acc;
      }, {} as AvailabilityForm);

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({
          id: state.user.id,
          availability: payload,
        });

      if (upsertError) throw upsertError;

      setAvailability(payload);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save availability");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="bg-white py-8 px-5 shadow sm:rounded-xl sm:px-8 border border-slate-200">
          <div className="text-center mb-7">
            <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
              <Clock size={24} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Set Your Availability</h2>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl mx-auto">
              Configure calendar availability and working hours. Planify uses this to auto-schedule tasks.
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Time zone</h3>
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
              <h3 className="text-2xl font-semibold text-slate-900">Working hours & days</h3>
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
                {orderedRows
                  .filter((day) => selectedDays[day])
                  .map((day) =>
                    availabilityForm[day].map((slot, slotIndex) => {
                      const isCopyMenuOpen = copySourceDay === day && slotIndex === 0;
                      const isAllChecked = DAYS.every((dayKey) => copySelections[dayKey]);

                      return (
                        <div key={`${day}-${slotIndex}`} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-xl text-slate-900 capitalize md:w-[140px] shrink-0">{slotIndex === 0 ? day : ""}</div>

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

          <div className="mt-7 flex justify-end">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Save & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
