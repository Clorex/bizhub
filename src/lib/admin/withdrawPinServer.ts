// FILE: src/lib/admin/withdrawPinServer.ts
import crypto from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

function pinPepper() {
  return String(process.env.ADMIN_WITHDRAW_PIN_PEPPER || "");
}

function pbkdf2Hash(pin: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  const key = crypto.pbkdf2Sync(`${pinPepper()}::${pin}`, salt, 120_000, 32, "sha256");
  return key.toString("hex");
}

function makeSaltHex() {
  return crypto.randomBytes(16).toString("hex");
}

export async function getAdminWithdrawPinState(uid: string) {
  const ref = adminDb.collection("adminWithdrawPins").doc(uid);
  const snap = await ref.get();
  const d = snap.exists ? (snap.data() as any) : null;

  return {
    set: !!d?.pinHash,
    setAtMs: Number(d?.setAtMs || 0) || null,
  };
}

export async function setAdminWithdrawPin(params: { uid: string; email: string; pin: string }) {
  const pin = String(params.pin || "");

  if (pin.length !== 14) {
    const err: any = new Error("PIN must be exactly 14 characters");
    err.code = "PIN_INVALID_LENGTH";
    throw err;
  }

  const ref = adminDb.collection("adminWithdrawPins").doc(params.uid);
  const snap = await ref.get();

  // Only allow setting once (you said if you ever share, you will rewrite code)
  if (snap.exists && (snap.data() as any)?.pinHash) {
    const err: any = new Error("PIN is already set");
    err.code = "PIN_ALREADY_SET";
    throw err;
  }

  const saltHex = makeSaltHex();
  const pinHash = pbkdf2Hash(pin, saltHex);
  const nowMs = Date.now();

  await ref.set(
    {
      uid: params.uid,
      email: params.email,
      saltHex,
      pinHash,
      setAtMs: nowMs,
      updatedAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
      createdAtMs: nowMs,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true as const };
}

export async function assertAdminWithdrawPin(params: { uid: string; pin: string }) {
  const ref = adminDb.collection("adminWithdrawPins").doc(params.uid);
  const snap = await ref.get();

  const d = snap.exists ? (snap.data() as any) : null;
  if (!d?.pinHash || !d?.saltHex) {
    const err: any = new Error("Withdrawal PIN not set");
    err.code = "PIN_NOT_SET";
    throw err;
  }

  const pin = String(params.pin || "");
  if (pin.length !== 14) {
    const err: any = new Error("PIN must be exactly 14 characters");
    err.code = "PIN_INVALID_LENGTH";
    throw err;
  }

  const computed = pbkdf2Hash(pin, String(d.saltHex));
  if (computed !== String(d.pinHash)) {
    const err: any = new Error("Invalid PIN");
    err.code = "PIN_INVALID";
    throw err;
  }

  return { ok: true as const };
}