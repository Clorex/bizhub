import { notFound, redirect } from "next/navigation";
import { getStoreNameBySlug, isPlaceholderSlug } from "@/lib/store/resolveStoreFromNext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StoreAliasPage({ params }: { params: { slug: string } }) {
  const slug = String(params?.slug || "").trim().toLowerCase();

  if (!slug || isPlaceholderSlug(slug)) notFound();

  // Validate store exists (proper 404 if not)
  const storeName = await getStoreNameBySlug(slug);
  if (!storeName) notFound();

  redirect(`/b/${slug}`);
}