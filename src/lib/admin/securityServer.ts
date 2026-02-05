// FILE: src/lib/admin/securityServer.ts
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth/server";

function adminEmails() {
  // default to your email if env not set
  const raw = process.env.ADMIN_EMAILS || "itabitamiracle090@gmail.com";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminStrict(req: Request) {
  const me = await requireRole(req, "admin");

  const allow = adminEmails();
  const email = String(me.email || "").toLowerCase();

  if (!email || !allow.includes(email)) {
    const err: any = new Error("Not allowed");
    err.code = "ADMIN_EMAIL_NOT_ALLOWED";
    throw err;
  }

  return me;
}

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) return null;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return { transporter, from };
}

function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function otpPepper() {
  return String(process.env.ADMIN_OTP_PEPPER || "");
}

function hashOtp(code: string) {
  return sha256(`${otpPepper()}::${code}`);
}

function sessionTtlMs() {
  const mins = Number(process.env.ADMIN_SESSION_TTL_MIN || 60);
  const safe = Number.isFinite(mins) && mins > 0 ? mins : 60;
  return safe * 60 * 1000;
}

function otpDocId(uid: string, scope: string) {
  const s = String(scope || "session").trim().slice(0, 40) || "session";
  return `${uid}__${s}`;
}

export async function getAdminSession(uid: string) {
  const ref = adminDb.collection("adminSessions").doc(uid);
  const snap = await ref.get();
  const d = snap.exists ? (snap.data() as any) : null;

  const verifiedUntilMs = Number(d?.verifiedUntilMs || 0);
  const verified = !!(verifiedUntilMs && verifiedUntilMs > Date.now());

  return { verified, verifiedUntilMs: verifiedUntilMs || 0, raw: d };
}

export async function requireAdminSessionVerified(req: Request) {
  const me = await requireAdminStrict(req);
  const s = await getAdminSession(me.uid);

  if (!s.verified) {
    const err: any = new Error("Admin session not verified");
    err.code = "ADMIN_SESSION_NOT_VERIFIED";
    throw err;
  }

  return me;
}

export async function markAdminSessionVerified(params: { uid: string; email: string }) {
  const nowMs = Date.now();
  const verifiedUntilMs = nowMs + sessionTtlMs();

  await adminDb.collection("adminSessions").doc(params.uid).set(
    {
      uid: params.uid,
      email: params.email,
      verifiedAtMs: nowMs,
      verifiedUntilMs,
      updatedAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
      createdAtMs: FieldValue.increment(0),
    },
    { merge: true }
  );

  const s = await adminDb.collection("adminSessions").doc(params.uid).get();
  const d = s.exists ? (s.data() as any) : null;
  if (d && (!d.createdAtMs || Number(d.createdAtMs) === 0)) {
    await adminDb.collection("adminSessions").doc(params.uid).set(
      { createdAtMs: nowMs, createdAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  return { verifiedUntilMs };
}

export async function sendAdminOtp(params: { uid: string; email: string; scope?: string }) {
  const scope = String(params.scope || "session").trim() || "session";

  const code = makeOtp();
  const expiresAtMs = Date.now() + 10 * 60 * 1000; // 10 mins

  await adminDb.collection("adminOtps").doc(otpDocId(params.uid, scope)).set(
    {
      uid: params.uid,
      email: params.email,
      scope,
      codeHash: hashOtp(code),
      expiresAtMs,
      attempts: 0,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const smtp = smtpConfig();
  if (!smtp) {
    const devCode = process.env.NODE_ENV !== "production" ? code : undefined;
    return { sent: false, devCode };
  }

  const subject =
    scope === "withdrawal" ? "myBizHub Admin withdrawal code" : "myBizHub Admin verification code";

  await smtp.transporter.sendMail({
    from: smtp.from,
    to: params.email,
    subject,
    text: `Your myBizHub admin code is: ${code}\n\nIt expires in 10 minutes.`,
  });

  return { sent: true as const, devCode: undefined };
}

export async function verifyAdminOtp(params: { uid: string; code: string; scope?: string }) {
  const scope = String(params.scope || "session").trim() || "session";

  const ref = adminDb.collection("adminOtps").doc(otpDocId(params.uid, scope));
  const snap = await ref.get();
  if (!snap.exists) {
    const err: any = new Error("No code requested");
    err.code = "NO_OTP";
    throw err;
  }

  const d = snap.data() as any;

  if (Date.now() > Number(d.expiresAtMs || 0)) {
    const err: any = new Error("Code expired. Request a new one.");
    err.code = "OTP_EXPIRED";
    throw err;
  }

  const attempts = Number(d.attempts || 0);
  if (attempts >= 5) {
    const err: any = new Error("Too many attempts. Request a new code.");
    err.code = "OTP_TOO_MANY_ATTEMPTS";
    throw err;
  }

  const ok = hashOtp(String(params.code || "").trim()) === String(d.codeHash || "");

  await ref.set(
    { attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  if (!ok) {
    const err: any = new Error("Invalid code");
    err.code = "OTP_INVALID";
    throw err;
  }

  await ref.delete().catch(() => {});
  return { ok: true as const };
}