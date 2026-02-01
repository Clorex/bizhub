import { db } from "@/lib/firebase/client";
import { collection, getDocs, limit, query } from "firebase/firestore";

export async function listBusinesses(max = 10) {
  const q = query(collection(db, "businesses"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function listTrendingProducts(max = 12) {
  // Simple: just grab first products. Later we’ll do analytics-based trending.
  const q = query(collection(db, "products"), limit(max));
  const snap = await getDocs(q);

  // Attach business slug/name if present on product, else best-effort
  return snap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      name: x.name,
      price: x.price,
      imageUrl: x.images?.[0] ?? null,
      businessId: x.businessId,
      businessSlug: x.businessSlug ?? x.storeSlug ?? "miracle-store",
      businessName: x.businessName ?? "Store",
    };
  });
}