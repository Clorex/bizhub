"use client";

import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";

export default function PromotionFaqPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <GradientHeader title="Promotion FAQ" subtitle="Quick answers" showBack={true} />

      <div className="px-4 pb-6 space-y-3">
        <SectionCard title="What is Promotion?" subtitle="Boost your product like ads">
          <p className="text-sm text-gray-700">
            Promotion helps your product appear more often in BizHub’s promoted slots on the marketplace.
            The more you fund your campaign, the more exposure it gets.
          </p>
        </SectionCard>

        <SectionCard title="How long can I promote?" subtitle="2+ days supported">
          <p className="text-sm text-gray-700">
            You can run a campaign for 2 days or more. Longer campaigns give more time for customers to discover your product.
          </p>
        </SectionCard>

        <SectionCard title="How does budget affect exposure?" subtitle="Higher budget = more reach">
          <p className="text-sm text-gray-700">
            Your daily budget increases the chance your campaign is selected and shown in promoted positions.
            Think of it like social ads: higher budget gives more visibility.
          </p>
        </SectionCard>

        <SectionCard title="Can I promote multiple products?" subtitle="Yes — up to 5 at a time">
          <p className="text-sm text-gray-700">
            You can promote up to 5 products in one campaign. In that case, the campaign’s exposure is shared across the selected products.
          </p>
        </SectionCard>

        <Card className="p-4">
          <p className="text-xs text-biz-muted">
            Tip: Start small, then increase budget if you want more traction.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => router.push("/vendor/promote")}>Create campaign</Button>
            <Button variant="secondary" onClick={() => router.push("/vendor/products")}>
              Back to products
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}