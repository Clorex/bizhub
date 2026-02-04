import { Suspense } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import StaffRegisterClient from "./register-client";

export const dynamic = "force-dynamic";

export default function StaffRegisterPage() {
  return (
    <div className="min-h-screen">
      <GradientHeader title="Staff Registration" subtitle="Join a business team" showBack />

      <div className="px-4 pb-24">
        <Suspense fallback={<Card className="p-4">Loading...</Card>}>
          <StaffRegisterClient />
        </Suspense>
      </div>
    </div>
  );
}