// FILE: src/lib/vendor/productsClient.ts
import { auth } from "@/lib/firebase/client";

export async function deleteVendorProduct(productId: string) {
  const id = String(productId || "").trim();
  if (!id) throw new Error("Invalid product ID.");

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Please log in again.");

  const r = await fetch(`/api/vendor/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "Could not delete product.");

  return data;
}