// FILE: src/components/accelerator/StepSimulator.tsx
"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";
import { simulateProfit } from "@/lib/accelerator/profit-simulator";
import type { BusinessIdea, SimulationResult } from "@/lib/accelerator/types";
import {
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Calendar,
  ChevronRight,
  Lock,
  Sliders,
} from "lucide-react";

const RISK_COLORS = {
  Low: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  High: "bg-red-100 text-red-700",
};

interface Props {
  idea: BusinessIdea;
  isApex?: boolean;
  onContinue: (simulation: SimulationResult) => void;
  onBack: () => void;
}

export function StepSimulator({ idea, isApex = false, onContinue, onBack }: Props) {
  const [capital, setCapital] = useState(idea.estimatedStartupCapital.min);
  const [marketingPercent, setMarketingPercent] = useState(15);
  const [showWhatIf, setShowWhatIf] = useState(false);

  const simulation = useMemo(
    () => simulateProfit({ idea, capitalInput: capital, marketingSpendPercent: marketingPercent }),
    [idea, capital, marketingPercent]
  );

  const capitalMin = Math.max(50000, idea.estimatedStartupCapital.min * 0.5);
  const capitalMax = idea.estimatedStartupCapital.max * 2;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">
          See your earning potential
        </h2>
        <p className="text-sm text-gray-500 mt-1">{idea.title}</p>
      </div>

      {/* Capital Slider */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-orange-600" />
          <p className="text-sm font-bold text-gray-900">Starting capital</p>
        </div>
        <p className="text-3xl font-black text-orange-600 text-center mb-3">
          {formatMoneyNGN(capital)}
        </p>
        <input
          type="range"
          min={capitalMin}
          max={capitalMax}
          step={10000}
          value={capital}
          onChange={(e) => setCapital(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">{formatMoneyNGN(capitalMin)}</span>
          <span className="text-[10px] text-gray-400">{formatMoneyNGN(capitalMax)}</span>
        </div>
      </Card>

      {/* What-If Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => setShowWhatIf(!showWhatIf)}
        leftIcon={<Sliders className="w-4 h-4" />}
      >
        {showWhatIf ? "Hide" : "Show"} &quot;What if&quot; scenarios
      </Button>

      {showWhatIf && (
        <Card className="p-4">
          <p className="text-sm font-bold text-gray-900 mb-2">Marketing spend</p>
          <p className="text-lg font-black text-center text-gray-900 mb-2">{marketingPercent}%</p>
          <input
            type="range"
            min={5}
            max={30}
            value={marketingPercent}
            onChange={(e) => setMarketingPercent(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">5%</span>
            <span className="text-[10px] text-gray-400">30%</span>
          </div>
        </Card>
      )}

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <TrendingUp className="w-5 h-5 text-blue-600 mx-auto mb-2" />
          <p className="text-[10px] text-gray-500 uppercase">Monthly Revenue</p>
          <p className="text-lg font-black text-gray-900">
            {formatMoneyNGN(simulation.projectedMonthlyRevenue)}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <DollarSign className="w-5 h-5 text-green-600 mx-auto mb-2" />
          <p className="text-[10px] text-gray-500 uppercase">Net Profit</p>
          <p className="text-lg font-black text-green-700">
            {formatMoneyNGN(simulation.projectedNetProfit)}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <Calendar className="w-5 h-5 text-orange-600 mx-auto mb-2" />
          <p className="text-[10px] text-gray-500 uppercase">Break-even</p>
          <p className="text-lg font-black text-gray-900">
            {simulation.breakEvenDays} days
          </p>
        </Card>
        <Card className="p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mx-auto mb-2" />
          <p className="text-[10px] text-gray-500 uppercase">Risk Level</p>
          <span className={cn("px-3 py-1 rounded-full text-xs font-bold", RISK_COLORS[simulation.riskLevel])}>
            {simulation.riskLevel}
          </span>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <SectionCard title="Cost breakdown" subtitle="Where your money goes">
        <div className="space-y-2">
          {simulation.costs.map((cost) => (
            <div key={cost.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{cost.label}</span>
              <span className="text-sm font-bold text-gray-900">{formatMoneyNGN(cost.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 bg-gray-50 rounded-xl px-3 -mx-1">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-sm font-black text-orange-600">{formatMoneyNGN(simulation.totalCosts)}</span>
          </div>
        </div>
      </SectionCard>

      {/* 6-Month Projection (Apex only) */}
      {simulation.sixMonthProjection && (
        <SectionCard
          title="6-Month forecast"
          subtitle={isApex ? "Advanced projection" : "Unlock with Apex"}
        >
          {isApex ? (
            <div className="space-y-2">
              {simulation.sixMonthProjection.map((m) => (
                <div key={m.month} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">Month {m.month}</span>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">{formatMoneyNGN(m.revenue)}</p>
                    <p className="text-[10px] text-green-600">Profit: {formatMoneyNGN(m.profit)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <div className="opacity-20 pointer-events-none space-y-2">
                {simulation.sixMonthProjection.slice(0, 3).map((m) => (
                  <div key={m.month} className="flex justify-between py-2">
                    <span className="text-sm">Month {m.month}</span>
                    <span className="text-sm">{formatMoneyNGN(m.revenue)}</span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Lock className="w-6 h-6 text-gray-400 mb-2" />
                <p className="text-xs font-bold text-gray-600">Apex feature</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => {}}>
                  Upgrade
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={() => onContinue(simulation)}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Continue
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400">
        Small steps. Big results.
      </p>
    </div>
  );
}
