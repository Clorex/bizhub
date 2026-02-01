// FILE: src/lib/buyers/freezeServer.ts
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { buyerKeyFrom, type BuyerKeyInput } from "@/lib/buyers/key";

export type BuyerFreezeState = {
  key: string;
  frozen: boolean;
  reason?: string | null;
};

export async function getBuyerFreezeState(input: BuyerKeyInput): Promise<BuyerFreezeState> {
  const { key } = buyerKeyFrom(input);
  if (!key) return { key: "", frozen: false };

  const ref = adminDb.collection("buyerSignals").doc(key);
  const snap = await ref.get();
  if (!snap.exists) return { key, frozen: false };

  const d = snap.data() as any;
  return { key, frozen: !!d.frozen, reason: d.frozenReason ?? null };
}

export async function assertBuyerNotFrozen(input: BuyerKeyInput) {
  const st = await getBuyerFreezeState(input);
  if (st.key && st.frozen) {
    const err: any = new Error(st.reason || "Buyer is currently restricted");
    err.code = "BUYER_FROZEN";
    err.buyerKey = st.key;
    throw err;
  }
}

export async function recordBuyerSignal(params: {
  input: BuyerKeyInput;
  patch: Record<string, any>;
}) {
  const { key, phone, email } = buyerKeyFrom(params.input);
  if (!key) return;

  const ref = adminDb.collection("buyerSignals").doc(key);
  await ref.set(
    {
      key,
      phone: phone || null,
      email: email || null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
      ...params.patch,
    },
    { merge: true }
  );
}

export async function setBuyerFrozen(params: {
  key: string;
  frozen: boolean;
  reason?: string | null;
  actorUid?: string | null;
}) {
  const key = String(params.key || "").trim();
  if (!key) throw new Error("Missing buyer key");

  const ref = adminDb.collection("buyerSignals").doc(key);
  await ref.set(
    {
      key,
      frozen: !!params.frozen,
      frozenReason: params.frozen ? String(params.reason || "Restricted") : null,
      frozenByUid: params.frozen ? (params.actorUid || null) : null,
      frozenAtMs: params.frozen ? Date.now() : null,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
}