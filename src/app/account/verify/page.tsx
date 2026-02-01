import { Suspense } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import VerifyClient from "./verify-client";

export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return (
    <div className="min-h-screen">
      <GradientHeader title="Verify Email" showBack={true} subtitle="Enter the 4-digit code" />

      <div className="px-4 pb-24">
        <Suspense fallback={<Card className="p-4">Loading...</Card>}>
          <VerifyClient />
        </Suspense>
      </div>
    </div>
  );
}