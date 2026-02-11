import { Suspense } from "react";
import { notFound } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import LoginClient from "./login-client";
import {
  resolveStoreNameFromSearchParams,
  isPlaceholderSlug,
} from "@/lib/store/resolveStoreFromNext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const { storeSlug, storeName } = await resolveStoreNameFromSearchParams(searchParams);

  // If user is coming from a store flow, enforce: slug must exist + resolve to a real store
  if (storeSlug) {
    if (isPlaceholderSlug(storeSlug)) notFound();
    if (!storeName) notFound();
  }

  const title = storeName ? `Login to ${storeName}` : "Login";

  return (
    <div className="min-h-screen">
      <GradientHeader title={title} showBack={true} />
      <div className="px-4 pb-24">
        <Suspense fallback={<Card className="p-4">Loading...</Card>}>
          <LoginClient storeName={storeName} />
        </Suspense>
      </div>
    </div>
  );
}