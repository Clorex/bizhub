// FILE: src/components/accelerator/ProgressBar.tsx
"use client";

import { cn } from "@/lib/cn";

const STEP_LABELS = [
  "Discover",
  "Ideas",
  "Simulate",
  "Suppliers",
  "Plan",
  "Dashboard",
];

export function ProgressBar({
  currentStep,
  totalSteps = 6,
}: {
  currentStep: number;
  totalSteps?: number;
}) {
  const percent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500">
          Step {currentStep} of {totalSteps}
        </p>
        <p className="text-xs font-bold text-orange-600">{percent}%</p>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className={cn(
              "text-[9px] font-medium transition-colors",
              i + 1 <= currentStep ? "text-orange-600" : "text-gray-300"
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
