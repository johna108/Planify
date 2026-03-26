import React from "react";
import {
  ArrowRight,
  BellRing,
  Brain,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Sparkles,
  ShieldCheck,
  Workflow,
} from "lucide-react";

type LandingPageProps = {
  onGetStarted: () => void;
};

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-50 text-stone-900">
      <div className="pointer-events-none absolute -left-24 top-12 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-32 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-stone-50">
              <Brain size={20} />
            </div>
            <div>
              <p className="text-xs text-stone-500">Smart planning, zero chaos</p>
              <h1 className="text-lg font-semibold tracking-tight">Planify</h1>
            </div>
          </div>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Sign in
            <ArrowRight size={15} />
          </button>
        </header>

        <main className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              <Sparkles size={13} />
              Fun planning assistant
            </div>

            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Plan your day
              <span className="block text-amber-600">like a pro, not a robot.</span>
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-600 sm:text-base">
              Paste messy notes, get clear tasks, and auto-fit them into your real schedule.
              Planify keeps it productive, flexible, and actually fun to use.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onGetStarted}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-800"
              >
                Get started free
                <ArrowRight size={16} />
              </button>
              <div className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-stone-50 px-5 py-3 text-sm text-stone-600">
                No credit card needed
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatChip label="Tasks organized" value="1.2M+" />
              <StatChip label="Time saved" value="6.3h/week" />
              <StatChip label="Users returning" value="91%" />
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-900">How Planify helps</h3>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Live workflow
                </span>
              </div>

              <div className="space-y-3">
                <FeatureRow
                  icon={<CalendarCheck2 size={17} />}
                  title="Adaptive scheduling"
                  text="Plans around your availability and fixed commitments."
                />
                <FeatureRow
                  icon={<BellRing size={17} />}
                  title="Smart reminders"
                  text="Nudges you before deadlines and key meetings."
                />
                <FeatureRow
                  icon={<Workflow size={17} />}
                  title="Auto-rescheduling"
                  text="If your day shifts, your task plan shifts with it."
                />
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-stone-900">Trusted for real routines</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <InlinePill icon={<CheckCircle2 size={14} />} text="Understands natural language" />
                <InlinePill icon={<Clock3 size={14} />} text="Works with your real day" />
                <InlinePill icon={<ShieldCheck size={14} />} text="Private account syncing" />
                <InlinePill icon={<Sparkles size={14} />} text="Simple and fun UI" />
              </div>
              <button
                onClick={onGetStarted}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
              >
                Continue to Sign in
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function InlinePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
      {icon}
      <span>{text}</span>
    </div>
  );
}

type FeatureRowProps = {
  icon: React.ReactNode;
  title: string;
  text: string;
};

function FeatureRow({ icon, title, text }: FeatureRowProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700">{icon}</div>
        <h3 className="font-semibold text-stone-900">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{text}</p>
    </div>
  );
}
