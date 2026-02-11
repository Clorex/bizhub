import "server-only";
import { adminDb } from "@/lib/firebase/admin";

function safeFirst(v: any): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

/**
 * Extract store slug from a "next" URL like:
 * - /b/my-store/checkout
 * - /b/my-store
 * - (or full URL) https://domain.com/b/my-store/checkout
 */
export function extractStoreSlugFromNext(nextParam?: string | null): string | null {
  const raw = String(nextParam || "").trim();
  if (!raw) return null;

  let pathname = raw;

  // If it's a full URL, parse it safely
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname || "";
    } catch {
      pathname = raw;
    }
  }

  const m = pathname.match(/^\/b\/([^\/\?\#]+)/i);
  if (!m) return null;

  const slug = String(m[1] || "").trim().toLowerCase();
  return slug || null;
}

/** Blocks placeholders like [slug] and other obvious dev placeholders */
export function isPlaceholderSlug(slug: string): boolean {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return true;
  if (s.includes("[") || s.includes("]")) return true; // catches [slug]
  if (s === "slug") return true;
  if (s === "%5bslug%5d") return true;
  return false;
}

export async function getStoreNameBySlug(slug: string): Promise<string | null> {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return null;

  // Firestore: businesses collection (same as your storefront page uses)
  const snap = await adminDb
    .collection("businesses")
    .where("slug", "==", s)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data() as any;

  const name =
    String(
      data?.name ||
        data?.storeName ||
        data?.businessName ||
        data?.title ||
        ""
    ).trim();

  return name || null;
}

/**
 * Helper for server pages: read searchParams.next (whatever shape), return storeName or null.
 */
export async function resolveStoreNameFromSearchParams(searchParams: any): Promise<{
  storeSlug: string | null;
  storeName: string | null;
}> {
  const next = safeFirst(searchParams?.next);
  const storeSlug = extractStoreSlugFromNext(next);
  if (!storeSlug) return { storeSlug: null, storeName: null };

  if (isPlaceholderSlug(storeSlug)) return { storeSlug, storeName: null };

  const storeName = await getStoreNameBySlug(storeSlug);
  return { storeSlug, storeName };
}