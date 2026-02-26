// FILE: src/lib/achievements/server.ts

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { AchievementKey } from "./keys";

/**
 * Unlock an achievement for an actor. Idempotent - won't unlock twice.
 * Returns true if newly unlocked, false if already existed.
 *
 * Stored in Firestore collection: "achievements"
 * Doc ID: `${actorType}_${actorId}_${key}`
 */
export async function unlockAchievement(params: {
  actorType: "vendor" | "customer";
  actorId: string;
  key: AchievementKey;
}): Promise<boolean> {
  const { actorType, actorId, key } = params;
  if (!actorId || !key) return false;

  const docId = `${actorType}_${actorId}_${key}`;
  const ref = adminDb.collection("achievements").doc(docId);

  try {
    const snap = await ref.get();
    if (snap.exists) return false; // already unlocked

    await ref.set({
      actorType,
      actorId,
      key,
      unlockedAt: FieldValue.serverTimestamp(),
      unlockedAtMs: Date.now(),
      seen: false,
    });

    return true;
  } catch (e) {
    console.error("Failed to unlock achievement:", e);
    return false;
  }
}

/**
 * Get all unseen achievements for an actor.
 */
export async function getUnseenAchievements(params: {
  actorType: "vendor" | "customer";
  actorId: string;
}): Promise<Array<{ key: AchievementKey; unlockedAtMs: number }>> {
  const { actorType, actorId } = params;
  if (!actorId) return [];

  try {
    const snap = await adminDb
      .collection("achievements")
      .where("actorType", "==", actorType)
      .where("actorId", "==", actorId)
      .where("seen", "==", false)
      .get();

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        key: data.key as AchievementKey,
        unlockedAtMs: Number(data.unlockedAtMs || 0),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Mark achievements as seen.
 * Uses set+merge instead of update to prevent failures if doc structure differs.
 */
export async function markAchievementsSeen(params: {
  actorType: "vendor" | "customer";
  actorId: string;
  keys: AchievementKey[];
}): Promise<boolean> {
  const { actorType, actorId, keys } = params;
  if (!actorId || !keys.length) return true;

  const batch = adminDb.batch();

  for (const key of keys) {
    const docId = `${actorType}_${actorId}_${key}`;
    const ref = adminDb.collection("achievements").doc(docId);
    // Use set+merge instead of update — safe even if doc is missing or malformed
    batch.set(ref, {
      seen: true,
      seenAtMs: Date.now(),
      seenAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  try {
    await batch.commit();
    return true;
  } catch (e) {
    console.error("Failed to mark achievements seen:", e);
    return false;
  }
}
