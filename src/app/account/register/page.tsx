import { Suspense } from "react";
import { notFound } from "next/navigation";
import ClientPage from "./page-client";
import {
  resolveStoreNameFromSearchParams,
  isPlaceholderSlug,
} from "@/lib/store/resolveStoreFromNext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const { storeSlug, storeName } = await resolveStoreNameFromSearchParams(searchParams);

  // If coming from store flow, enforce store existence (proper 404)
  if (storeSlug) {
    if (isPlaceholderSlug(storeSlug)) notFound();
    if (!storeName) notFound();
  }

  return (
    <Suspense fallback={null}>
      <ClientPage storeName={storeName} />
    </Suspense>
  );
}