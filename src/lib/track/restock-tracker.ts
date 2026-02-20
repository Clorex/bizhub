// FILE: src/lib/track/restock-tracker.ts
// Lightweight tracker called from /api/track to record
// cart-add and save events into Firestore for the product metrics aggregator.

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Record a cart-add event for restock tracking.
 * Stored in Firestore cartEvents collection for daily aggregation.
 */
export async function trackCartAdd(params: {
  productId: string;
  businessId: string;
  userId?: string;
}) {
  try {
    await adminDb.collection("cartEvents").add({
      productId: params.productId,
      businessId: params.businessId,
      userId: params.userId || null,
      type: "add_to_cart",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Record a product save event for restock tracking.
 * Stored in Firestore productSaves collection for daily aggregation.
 */
export async function trackProductSave(params: {
  productId: string;
  businessId: string;
  userId?: string;
}) {
  try {
    await adminDb.collection("productSaves").add({
      productId: params.productId,
      businessId: params.businessId,
      userId: params.userId || null,
      type: "save",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}
