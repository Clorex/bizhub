// FILE: src/components/restock/RestockUpsellCard.tsx
"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import {
  ShieldAlert,
  TrendingUp,
  Package,
  Eye,
  ChevronRight,
  Zap,
} from "lucide-react";

export function RestockUpsellCard() {
  const router = useRouter();

  return (
    <Card className="overflow-hidden">
      {/* Header gradient */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-orange-500 p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />

        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold">
            Smart Restock & Demand Alerts
          </h3>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">
            Never miss a stockout or rising demand again. Your products,
            monitored 24/7.
          </p>
        </div>
      </div>

      {/* Features list */}
      <div className="p-5 space-y-4">
        <FeatureRow
          icon={Package}
          title="Stockout Prediction"
          desc="Know days in advance when stock will run out"
        />
        <FeatureRow
          icon={TrendingUp}
          title="Demand Spike Detection"
          desc="Catch rising interest before competitors do"
        />
        <FeatureRow
          icon={Eye}
          title="Conversion Insights"
          desc="Find products with high views but low sales"
        />
        <FeatureRow
          icon={Zap}
          title="Opportunity Alerts"
          desc="Spot your trending products automatically"
        />

        <div className="pt-2">
          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-3">
            Apex Plan Feature
          </p>
          <Button
            onClick={() => router.push("/vendor/subscription")}
            className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-700 hover:to-orange-600"
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Upgrade to Apex
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Package;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-purple-600" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
