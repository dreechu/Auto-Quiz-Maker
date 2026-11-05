"use client";

import { Check, LoaderCircle } from "lucide-react";

export function TaskProgress({
  steps,
  activeStep,
}: {
  steps: string[];
  activeStep: number;
}) {
  const currentStep = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const progress = Math.min(85, Math.round(((currentStep + 0.65) / steps.length) * 100));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
          <LoaderCircle size={14} className="shrink-0 animate-spin text-indigo-600" />
          <span className="truncate">{steps[currentStep]}</span>
        </p>
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400">
          Step {currentStep + 1} of {steps.length}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={steps[currentStep]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {steps.map((step, index) => (
          <span
            key={step}
            className={`inline-flex items-center gap-1 text-[10px] ${
              index < currentStep
                ? "font-medium text-emerald-700"
                : index === currentStep
                  ? "font-semibold text-indigo-700"
                  : "text-slate-400"
            }`}
          >
            {index < currentStep ? <Check size={11} /> : <span>{index + 1}.</span>}
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}
