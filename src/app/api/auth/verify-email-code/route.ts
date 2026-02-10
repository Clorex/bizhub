
import { requireMe } from "@/lib/auth/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hash(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);
    const { code } = await req.json();

    if (!code) return Response.json({ error: "code required" }, { status: 400 });

    const ref = adminDb.collection("emailVerifications").doc(me.uid);
    const snap = await ref.get();
    if (!snap.exists) return Response.json({ error: "No code requested" }, { status: 400 });

    const data = snap.data() as any;

    if (Date.now() > Number(data.expiresAtMs || 0)) {
      return Response.json({ error: "Code expired. Request a new one." }, { status: 400 });
    }

    const attempts = Number(data.attempts || 0);
    if (attempts >= 5) {
      return Response.json({ error: "Too many attempts. Request a new code." }, { status: 400 });
    }

    const ok = hash(String(code).trim()) === data.codeHash;
    await ref.set({ attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    if (!ok) return Response.json({ error: "Invalid code" }, { status: 400 });

    // Mark email verified in Firebase Auth
    await adminAuth.updateUser(me.uid, { emailVerified: true });

    // Clean up
    await ref.delete();

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}