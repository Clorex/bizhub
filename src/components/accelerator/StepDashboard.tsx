// FILE: src/components/accelerator/StepDashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";
import type { BusinessIdea, SimulationResult, ActionPlanDay } from "@/lib/accelerator/types";
import {
  TrendingUp,
  DollarSign,
  Package,
  Bell,
  Sparkles,
  Rocket,
  Star,
  Trophy,
  ChevronRight,
  Zap,
} from "lucide-react";

interface Props {
  idea: BusinessIdea;
  simulation: SimulationResult;
  actionPlan: ActionPlanDay[];
}

export function StepDashboard({ idea, simulation, actionPlan }: Props) {
  const router = useRouter();
  const [showCelebration, setShowCelebration] = useState(true);
  const completedDays = actionPlan.filter((d) => d.completed).length;
  const totalDays = actionPlan.length;

  useEffect(() => {
    const timer = setTimeout(() => setShowCelebration(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-4">
      {/* Celebration */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-card-in">
          <Card className="p-8 mx-4 text-center max-w-sm">
            <div className="text-6xl mb-4">{"\uD83C\uDF89"}</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">
              You did it!
            </h2>
            <p className="text-sm text-gray-600">
              Your business journey has officially started. Welcome to myBizHub!
            </p>
            <Button className="mt-6 w-full" onClick={() => setShowCelebration(false)}>
              Let&apos;s go!
            </Button>
          </Card>
        </div>
      )}

      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-3">
          <Rocket className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          Your Starter Dashboard
        </h2>
        <p className="text-sm text-gray-500 mt-1">{idea.title}</p>
      </div>

      {/* Revenue Tracker */}
      <Card className="p-5 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-100">
          Revenue Target (Monthly)
        </p>
        <p className="text-3xl font-black mt-2">
          {formatMoneyNGN(simulation.projectedMonthlyRevenue)}
        </p>
        <p className="text-sm text-orange-100 mt-1 flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          Based on your simulation
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-[10px] text-orange-100">Current</p>
            <p className="text-lg font-bold">{formatMoneyNGN(0)}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-[10px] text-orange-100">Target</p>
            <p className="text-lg font-bold">{formatMoneyNGN(simulation.projectedMonthlyRevenue)}</p>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <DollarSign className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-900">{formatMoneyNGN(0)}</p>
          <p className="text-[9px] text-gray-500 uppercase">Expenses</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingUp className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-900">{formatMoneyNGN(0)}</p>
          <p className="text-[9px] text-gray-500 uppercase">Profit</p>
        </Card>
        <Card className="p-3 text-center">
          <Package className="w-5 h-5 text-purple-600 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-900">0</p>
          <p className="text-[9px] text-gray-500 uppercase">Sales</p>
        </Card>
      </div>

      {/* Smart Tips */}
      <SectionCard title="Smart tips" subtitle="Keep going!">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              You&apos;re 1 sale away from your first milestone. Share your store link today!
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
            <Bell className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <p className="text-xs text-green-800">
              Restock reminder: Check your inventory levels before your first big sales push.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Badges */}
      <SectionCard title="Your badges" subtitle="Achievements unlocked">
        <div className="flex gap-3">
          <div className="flex-1 p-3 bg-orange-50 rounded-xl text-center">
            <Rocket className="w-6 h-6 text-orange-600 mx-auto mb-1" />
            <p className="text-[10px] font-bold text-orange-700">Launch Streak</p>
          </div>
          <div className={cn(
            "flex-1 p-3 rounded-xl text-center",
            completedDays >= 7 ? "bg-green-50" : "bg-gray-50"
          )}>
            <Trophy className={cn("w-6 h-6 mx-auto mb-1", completedDays >= 7 ? "text-green-600" : "text-gray-300")} />
            <p className={cn("text-[10px] font-bold", completedDays >= 7 ? "text-green-700" : "text-gray-400")}>
              7-Day Complete
            </p>
          </div>
          <div className="flex-1 p-3 bg-gray-50 rounded-xl text-center">
            <Star className="w-6 h-6 text-gray-300 mx-auto mb-1" />
            <p className="text-[10px] font-bold text-gray-400">First Sale</p>
          </div>
        </div>
      </SectionCard>

      {/* Launch Plan Progress */}
      <SectionCard title="Launch plan" subtitle={`${completedDays}/${totalDays} completed`}>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all"
            style={{ width: `${Math.round((completedDays / totalDays) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          {completedDays < totalDays
            ? "Keep going! Complete your 7-day plan to earn your badge."
            : "Amazing work! You\u2019ve completed your launch plan!"}
        </p>
      </SectionCard>

      {/* CTA */}
      <Card className="p-5 bg-gradient-to-br from-purple-50 to-orange-50 border-purple-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Ready to set up your store?</p>
            <p className="text-xs text-gray-600 mt-1">
              Create your myBizHub store and start selling to real customers today.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => router.push("/vendor")}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Create my store
            </Button>
          </div>
        </div>
      </Card>

      <p className="text-center text-xs text-gray-400">
        Your business starts today. {"\uD83D\uDE80"}
      </p>
    </div>
  );
}
