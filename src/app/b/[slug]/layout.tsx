import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getStoreNameBySlug, isPlaceholderSlug } from "@/lib/store/resolveStoreFromNext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StoreSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) {
  const slug = String(params?.slug || "").trim().toLowerCase();

  // Block placeholders like [slug]
  if (!slug || isPlaceholderSlug(slug)) {
    notFound();
  }

  // Ensure store exists (proper 404 if not)
  const storeName = await getStoreNameBySlug(slug);
  if (!storeName) {
    notFound();
  }

  return <>{children}</>;
}