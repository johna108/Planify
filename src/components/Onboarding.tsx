import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function Onboarding() {
  const { state, setAvailability } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Default 9 to 5 for weekdays, off for weekends
  const [availabilityForm, setAvailabilityForm] = useState(
    DAYS.reduce((acc, day) => {
      const isWeekend = day === 'saturday' || day === 'sunday';
      acc[day] = {
        enabled: !isWeekend,
        start: '09:00',
        end: '17:00'
      };
      return acc;
    }, {} as any)
  );

  const handleDayChange = (day: string, field: string, value: any) => {
    setAvailabilityForm((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleSetAllDay = (day: string) => {
    setAvailabilityForm((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: true,
        start: '00:00',
        end: '23:59'
      }
    }));
  };

  const handleSave = async () => {
    if (!state.user) return;
    setLoading(true);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: state.user.id,
          availability: availabilityForm
        });

      if (upsertError) throw upsertError;
      
      setAvailability(availabilityForm);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save availability');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-slate-200">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
              <Clock size={24} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Set Your Availability</h2>
            <p className="mt-2 text-sm text-slate-600">
              When are you typically available to work on tasks? FlowMind will use this to automatically schedule your tasks.
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3 w-1/3">
                  <input
                    type="checkbox"
                    checked={availabilityForm[day].enabled}
                    onChange={(e) => handleDayChange(day, 'enabled', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700 capitalize">{day}</span>
                </div>
                
                <div className="flex items-center gap-4 flex-1 justify-end">
                  {availabilityForm[day].enabled ? (
                    <>
                      <input
                        type="time"
                        value={availabilityForm[day].start}
                        onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="text-slate-500 text-sm">to</span>
                      <input
                        type="time"
                        value={availabilityForm[day].end}
                        onChange={(e) => handleDayChange(day, 'end', e.target.value)}
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

          <div className="mt-8 flex justify-end">
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
