// FILE: src/components/accelerator/StepIdeas.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";
import type { BusinessIdea } from "@/lib/accelerator/types";
import {
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  Zap,
  ChevronRight,
  ArrowLeftRight,
  X,
} from "lucide-react";

const DIFFICULTY_COLORS = {
  Easy: "bg-green-100 text-green-700",
  Moderate: "bg-yellow-100 text-yellow-700",
  Advanced: "bg-red-100 text-red-700",
};

const DEMAND_COLORS = {
  Low: "bg-gray-100 text-gray-600",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-green-100 text-green-700",
};

interface Props {
  ideas: BusinessIdea[];
  onSelect: (idea: BusinessIdea) => void;
  onBack: () => void;
}

export function StepIdeas({ ideas, onSelect, onBack }: Props) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const compareIdeas = ideas.filter((i) => compareIds.includes(i.id));

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">
          Here are your best matches
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          We found {ideas.length} ideas that fit your profile.
        </p>
      </div>

      {compareIds.length >= 2 && !showCompare && (
        <Button
          className="w-full"
          variant="secondary"
          onClick={() => setShowCompare(true)}
          leftIcon={<ArrowLeftRight className="w-4 h-4" />}
        >
          Compare {compareIds.length} ideas
        </Button>
      )}

      {/* Compare Modal */}
      {showCompare && (
        <Card className="p-4 border-orange-200 bg-orange-50/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Side-by-side comparison</h3>
            <button onClick={() => setShowCompare(false)} className="p-1">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-orange-200">
                  <th className="text-left py-2 pr-2 font-bold text-gray-600">Metric</th>
                  {compareIdeas.map((idea) => (
                    <th key={idea.id} className="text-left py-2 px-2 font-bold text-gray-900 min-w-[120px]">
                      {idea.title.length > 20 ? idea.title.slice(0, 20) + "..." : idea.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-2 text-gray-600">Startup Cost</td>
                  {compareIdeas.map((idea) => (
                    <td key={idea.id} className="py-2 px-2 font-medium">
                      {formatMoneyNGN(idea.estimatedStartupCapital.min)} - {formatMoneyNGN(idea.estimatedStartupCapital.max)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-2 text-gray-600">Monthly Profit</td>
                  {compareIdeas.map((idea) => (
                    <td key={idea.id} className="py-2 px-2 font-medium text-green-700">
                      {formatMoneyNGN(idea.estimatedMonthlyProfit.min)} - {formatMoneyNGN(idea.estimatedMonthlyProfit.max)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-2 text-gray-600">Difficulty</td>
                  {compareIdeas.map((idea) => (
                    <td key={idea.id} className="py-2 px-2">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", DIFFICULTY_COLORS[idea.difficulty])}>
                        {idea.difficulty}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-2 text-gray-600">Demand</td>
                  {compareIdeas.map((idea) => (
                    <td key={idea.id} className="py-2 px-2">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", DEMAND_COLORS[idea.demandScore])}>
                        {idea.demandScore}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-2 text-gray-600">First Sale</td>
                  {compareIdeas.map((idea) => (
                    <td key={idea.id} className="py-2 px-2 font-medium">{idea.timeToFirstSale}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Idea Cards */}
      {ideas.map((idea, idx) => (
        <Card
          key={idea.id}
          className={cn("p-5 transition-all", `animate-card-in animate-card-in-delay-${Math.min(idx, 4)}`)}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-base font-bold text-gray-900">{idea.title}</h3>
            <button
              onClick={() => toggleCompare(idea.id)}
              className={cn(
                "shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition",
                compareIds.includes(idea.id)
                  ? "border-orange-500 bg-orange-500"
                  : "border-gray-200 hover:border-orange-300"
              )}
            >
              {compareIds.includes(idea.id) && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">{idea.description}</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Startup</p>
                <p className="text-xs font-bold">
                  {formatMoneyNGN(idea.estimatedStartupCapital.min)} - {formatMoneyNGN(idea.estimatedStartupCapital.max)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Monthly Profit</p>
                <p className="text-xs font-bold text-green-700">
                  {formatMoneyNGN(idea.estimatedMonthlyProfit.min)} - {formatMoneyNGN(idea.estimatedMonthlyProfit.max)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">First Sale</p>
                <p className="text-xs font-bold">{idea.timeToFirstSale}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Demand</p>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", DEMAND_COLORS[idea.demandScore])}>
                  {idea.demandScore}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", DIFFICULTY_COLORS[idea.difficulty])}>
              {idea.difficulty}
            </span>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 mb-4">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 font-medium">{idea.whyItFitsYou}</p>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => onSelect(idea)}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Explore this idea
          </Button>
        </Card>
      ))}

      <Button variant="ghost" className="w-full" onClick={onBack}>
        Go back and change my answers
      </Button>
    </div>
  );
}
