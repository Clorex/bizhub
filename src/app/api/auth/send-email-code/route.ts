
import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeCode() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4 digits
}

function hash(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function sendEmail(to: string, code: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    // No SMTP configured
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject: "myBizHub verification code",
    text: `Your myBizHub verification code is: ${code}\n\nIt expires in 10 minutes.`,
  });

  return { sent: true };
}

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);
    if (!me.email) return Response.json({ error: "Missing email" }, { status: 400 });

    const code = makeCode();
    const expiresAtMs = Date.now() + 10 * 60 * 1000; // 10 minutes

    await adminDb.collection("emailVerifications").doc(me.uid).set(
      {
        uid: me.uid,
        email: me.email,
        codeHash: hash(code),
        expiresAtMs,
        attempts: 0,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const emailResult = await sendEmail(me.email, code);

    // Dev fallback if SMTP missing
    const devCode =
      process.env.NODE_ENV !== "production" && !emailResult.sent ? code : undefined;

    return Response.json({
      ok: true,
      sent: emailResult.sent,
      devCode, // only appears in dev when SMTP not set
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}