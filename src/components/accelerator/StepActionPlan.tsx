// FILE: src/components/accelerator/StepActionPlan.tsx
"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ActionPlanDay, BusinessIdea } from "@/lib/accelerator/types";
import { generate7DayPlan } from "@/lib/accelerator/plan-generator";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Download,
  Sparkles,
  Rocket,
} from "lucide-react";
import { toast } from "@/lib/ui/toast";

interface Props {
  idea: BusinessIdea;
  isApex?: boolean;
  onContinue: (plan: ActionPlanDay[]) => void;
  onBack: () => void;
}

export function StepActionPlan({ idea, isApex = false, onContinue, onBack }: Props) {
  const [plan, setPlan] = useState<ActionPlanDay[]>(() => generate7DayPlan(idea));

  const completedCount = plan.filter((d) => d.completed).length;
  const percentage = Math.round((completedCount / plan.length) * 100);

  const toggleDay = (day: number) => {
    setPlan((prev) =>
      prev.map((d) => (d.day === day ? { ...d, completed: !d.completed } : d))
    );
  };

  const downloadChecklist = () => {
    const text = plan
      .map((d) => `${d.completed ? "[x]" : "[ ]"} Day ${d.day}: ${d.title}\n    ${d.description}`)
      .join("\n\n");

    const blob = new Blob(
      [`7-Day Launch Plan - ${idea.title}\n${"=".repeat(40)}\n\n${text}`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `launch-plan-${idea.title.toLowerCase().replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Checklist downloaded!");
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
          <Rocket className="w-7 h-7 text-orange-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          Your 7-day launch roadmap
        </h2>
        <p className="text-sm text-gray-500 mt-1">{idea.title}</p>
      </div>

      {/* Progress */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-900">Progress</p>
          <p className="text-sm font-bold text-orange-600">{percentage}%</p>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              percentage === 100
                ? "bg-gradient-to-r from-green-500 to-emerald-400"
                : "bg-gradient-to-r from-orange-500 to-orange-400"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {completedCount} of {plan.length} tasks completed
        </p>

        {percentage === 100 && (
          <div className="mt-3 p-3 bg-green-50 rounded-xl text-center">
            <p className="text-sm font-bold text-green-700">
              {"\uD83C\uDF89"} Amazing! You completed your launch plan!
            </p>
          </div>
        )}
      </Card>

      {/* Days */}
      {plan.map((day) => (
        <Card key={day.day} className="p-4">
          <button
            onClick={() => toggleDay(day.day)}
            className="w-full flex items-start gap-3 text-left"
          >
            {day.completed ? (
              <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-6 h-6 text-gray-300 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-orange-600 uppercase">
                  Day {day.day}
                </span>
              </div>
              <h3
                className={cn(
                  "text-sm font-bold mt-0.5",
                  day.completed ? "text-gray-400 line-through" : "text-gray-900"
                )}
              >
                {day.title}
              </h3>
              <p
                className={cn(
                  "text-xs mt-1 leading-relaxed",
                  day.completed ? "text-gray-300" : "text-gray-600"
                )}
              >
                {day.description}
              </p>
            </div>
          </button>
        </Card>
      ))}

      {/* Download */}
      <Button
        variant="secondary"
        className="w-full"
        leftIcon={<Download className="w-4 h-4" />}
        onClick={downloadChecklist}
      >
        Download checklist
      </Button>

      {/* Apex AI Suggestions */}
      {isApex && (
        <Card className="p-4 bg-purple-50 border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <p className="text-sm font-bold text-purple-900">AI Growth Tips</p>
          </div>
          <p className="text-xs text-purple-700">
            Based on your business type, consider offering a small launch discount of
            10-15% to your first 20 customers. This creates urgency and builds early
            trust and reviews.
          </p>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={() => onContinue(plan)}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Launch my business
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400">
        You can do this. Small steps. Big results.
      </p>
    </div>
  );
}
