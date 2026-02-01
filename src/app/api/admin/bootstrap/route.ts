import { NextResponse } from "next/server";
import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);
    const allow = adminEmails();

    if (!me.email || !allow.includes(me.email.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    await adminDb.collection("users").doc(me.uid).set(
      {
        uid: me.uid,
        email: me.email ?? null,
        role: "admin",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, role: "admin" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 401 });
  }
}