import React from "react";
import { useAppContext } from "../context/AppContext";
import { Calendar, Clock } from "lucide-react";
import { format, parseISO, startOfDay, addHours, eachHourOfInterval, addDays, isSameDay } from "date-fns";
import { motion } from "motion/react";

export function CalendarView() {
  const { state } = useAppContext();
  const today = new Date();
  
  // Create a timeline for 3 days
  const days = [today, addDays(today, 1), addDays(today, 2)];

  const getTaskStyle = (task: any, dayIndex: number) => {
    const start = parseISO(task.scheduledStart);
    const end = parseISO(task.scheduledEnd);
    
    // Calculate position and height based on time
    // 0 AM is 0px, each hour is 60px
    const startOffset = start.getHours() * 60 + start.getMinutes();
    const duration = (end.getTime() - start.getTime()) / (1000 * 60); // in minutes
    
    let bgColor = "bg-indigo-100 border-indigo-300 text-indigo-800";
    if (task.status === "Completed") bgColor = "bg-emerald-100 border-emerald-300 text-emerald-800 opacity-60";
    if (task.status === "Missed") bgColor = "bg-red-100 border-red-300 text-red-800";
    if (task.status === "Rescheduled") bgColor = "bg-amber-100 border-amber-300 text-amber-800";

    return {
      top: `${startOffset}px`,
      height: `${duration}px`,
      className: `absolute left-16 right-4 rounded-md border p-2 shadow-sm overflow-hidden transition-all hover:shadow-md hover:z-10 ${bgColor}`,
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
            <Calendar size={18} />
          </span>
          Schedule
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto relative border border-slate-100 rounded-lg bg-slate-50/50">
        <div className="flex flex-col gap-8 p-2">
          {days.map((day, dayIndex) => {
            const start = startOfDay(day);
            const end = addHours(startOfDay(day), 23);
            const hours = eachHourOfInterval({ start, end });
            const dayTasks = state.tasks.filter((t) => isSameDay(parseISO(t.scheduledStart), day));

            return (
              <div key={dayIndex} className="relative">
                <h3 className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-sm py-2 px-4 text-sm font-bold text-slate-700 border-b border-slate-200 mb-2 rounded-t-lg">
                  {dayIndex === 0 ? "Today" : dayIndex === 1 ? "Tomorrow" : format(day, "EEEE, MMM d")}
                </h3>
                <div className="relative min-h-[1440px] overflow-hidden">
                  {/* Time grid */}
                  {hours.map((hour, i) => (
                    <div
                      key={i}
                      className="absolute w-full flex items-start border-t border-slate-200"
                      style={{ top: `${i * 60}px`, height: "60px" }}
                    >
                      <div className="w-14 text-right pr-2 pt-1">
                        <span className="text-xs font-medium text-slate-400">
                          {format(hour, "h a")}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Current time indicator (only for today) */}
                  {dayIndex === 0 && (
                    <div
                      className="absolute left-14 right-0 border-t-2 border-red-400 z-20 pointer-events-none"
                      style={{
                        top: `${today.getHours() * 60 + today.getMinutes()}px`,
                      }}
                    >
                      <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-400 rounded-full"></div>
                    </div>
                  )}

                  {/* Tasks */}
                  {dayTasks.map((task) => {
                    const style = getTaskStyle(task, dayIndex);
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={style.className}
                        style={{ top: style.top, height: style.height }}
                      >
                        <div className="flex flex-col h-full">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold truncate">{task.title}</span>
                            {task.status === "Missed" && (
                              <span className="text-[10px] font-bold bg-red-200 text-red-800 px-1.5 py-0.5 rounded uppercase">
                                Missed
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] opacity-80 mt-auto flex items-center gap-1">
                            <Clock size={10} />
                            {format(parseISO(task.scheduledStart), "h:mm")} - {format(parseISO(task.scheduledEnd), "h:mm")}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
