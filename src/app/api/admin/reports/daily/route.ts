import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import nodemailer from "nodemailer";
import { buildDailyPlatformReport } from "@/lib/reports/platformDaily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTransport() {
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

function isCronAuthorized(req: Request) {
  const token = req.headers.get("x-cron-token") || "";
  const expected = process.env.DAILY_REPORT_CRON_TOKEN || "";
  return expected && token && token === expected;
}

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");
    const report = await buildDailyPlatformReport();
    return NextResponse.json({ ok: true, report });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Allow either admin user OR cron token
    const cronOk = isCronAuthorized(req);
    if (!cronOk) {
      await requireRole(req, "admin");
    }

    const report = await buildDailyPlatformReport();

    const to = process.env.DAILY_REPORT_EMAIL_TO || "bizhub6041@gmail.com";

    const t = getTransport();
    if (!t) {
      return NextResponse.json(
        { ok: false, error: "SMTP is not configured (SMTP_HOST/USER/PASS/FROM)." },
        { status: 500 }
      );
    }

    await t.transporter.sendMail({
      from: t.from,
      to,
      subject: `BizHub Daily Report — ${report.dayKey}`,
      text: report.text,
    });

    return NextResponse.json({ ok: true, sentTo: to, dayKey: report.dayKey });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}