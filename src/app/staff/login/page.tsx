import { Suspense } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import StaffLoginClient from "./login-client";

export const dynamic = "force-dynamic";

export default function StaffLoginPage() {
  return (
    <div className="min-h-screen">
      <GradientHeader title="Staff Login" subtitle="Login to continue" showBack />

      <div className="px-4 pb-24">
        <Suspense fallback={<Card className="p-4">Loading...</Card>}>
          <StaffLoginClient />
        </Suspense>
      </div>
    </div>
  );
}