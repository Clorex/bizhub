import { db } from "@/lib/firebase/client";
import type { Business, Product } from "@/lib/types";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";

export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  const q = query(collection(db, "businesses"), where("slug", "==", slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Business, "id">) };
}

export async function listProductsByBusinessId(businessId: string): Promise<Product[]> {
  const q = query(collection(db, "products"), where("businessId", "==", businessId));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }));
}

export async function getProductById(productId: string): Promise<Product | null> {
  const ref = doc(db, "products", productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return { id: snap.id, ...(snap.data() as Omit<Product, "id">) };
}
