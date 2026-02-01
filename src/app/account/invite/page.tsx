import { Suspense } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import InviteAcceptClient from "./invite-client";

export const dynamic = "force-dynamic";

export default function StaffInviteAcceptPage() {
  return (
    <div className="min-h-screen">
      <GradientHeader title="Staff Invite" subtitle="Join a business as staff" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        <Suspense fallback={<Card className="p-5 text-center">Loading...</Card>}>
          <InviteAcceptClient />
        </Suspense>
      </div>
    </div>
  );
}