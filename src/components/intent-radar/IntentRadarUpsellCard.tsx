// FILE: src/components/intent-radar/IntentRadarUpsellCard.tsx
"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import {
  Radar,
  Flame,
  TrendingUp,
  Users,
  Zap,
  ChevronRight,
} from "lucide-react";

export function IntentRadarUpsellCard() {
  const router = useRouter();

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
            <Radar className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold">Buyer Intent Radar</h3>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">
            Know when buyers are ready to purchase. Get actionable signals before they leave.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <FeatureRow icon={Flame} title="Hot Deal Detection" desc="Know when multiple buyers show purchase intent" />
        <FeatureRow icon={TrendingUp} title="Interest Tracking" desc="Views, carts, saves, contacts — all monitored" />
        <FeatureRow icon={Users} title="Privacy-Safe" desc="No buyer identity exposed — only aggregated signals" />
        <FeatureRow icon={Zap} title="Action Suggestions" desc="Get told exactly what to do: promo, restock, respond" />

        <div className="pt-2">
          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-3">
            Apex Plan Advantage
          </p>
          <Button
            onClick={() => router.push("/vendor/subscription")}
            className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600"
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Upgrade to Apex
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FeatureRow({ icon: Icon, title, desc }: { icon: typeof Flame; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-red-600" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
