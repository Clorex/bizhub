import { Suspense } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import LoginClient from "./login-client";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <GradientHeader title="Login" showBack={true} />
      <div className="px-4 pb-24">
        <Suspense fallback={<Card className="p-4">Loading...</Card>}>
          <LoginClient />
        </Suspense>
      </div>
    </div>
  );
}