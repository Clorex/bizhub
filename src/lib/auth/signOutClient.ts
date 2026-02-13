// FILE: src/lib/auth/signOutClient.ts
"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export async function signOutClient(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await signOut(auth);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || "Failed to sign out") };
  }
}