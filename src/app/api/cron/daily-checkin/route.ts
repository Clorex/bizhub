import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { buildBusinessDailySnapshot } from "@/lib/checkin/buildBusinessDailySnapshot";
import { groqGenerateDailyCheckin } from "@/lib/ai/groq";
import { sendBusinessPush } from "@/lib/push/sendBusinessPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function lagosDayKey(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function cleanInt(v: any, min: number, max: number) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  try {
    // ---- VERCEL CRON AUTH (OFFICIAL WAY) ----
    const isCron = req.headers.get("x-vercel-cron") === "1";

    if (!isCron) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("Daily check-in cron started", {
      at: new Date().toISOString(),
    });

    const url = new URL(req.url);

    const dk = lagosDayKey(new Date());
    const limit = cleanInt(url.searchParams.get("limit"), 60, 200);
    const cursor = String(url.searchParams.get("cursor") || "").trim();

    let q = adminDb
      .collection("businesses")
      .orderBy(FieldPath.documentId())
      .limit(limit);

    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    const businessDocs = snap.docs;

    let created = 0;
    let skipped = 0;
    let pushed = 0;
    const errors: any[] = [];

    for (const b of businessDocs) {
      const businessId = b.id;
      const biz = b.data() as any;

      const slug = String(biz?.slug || "").trim();
      if (!slug) {
        skipped += 1;
        continue;
      }

      const ref = adminDb
        .collection("businesses")
        .doc(businessId)
        .collection("dailyCheckins")
        .doc(dk);

      const existing = await ref.get();
      if (existing.exists) {
        skipped += 1;
        continue;
      }

      try {
        const snapshot = await buildBusinessDailySnapshot({ businessId });

        const storeName = String(
          snapshot?.business?.name ||
            snapshot?.business?.slug ||
            "Store"
        );

        const ai = await groqGenerateDailyCheckin({
          dayKey: dk,
          storeName,
          snapshot,
        });

        const todayLine = `Today: ${Number(
          snapshot?.today?.orders || 0
        )} order(s) • ${fmtNaira(
          Number(snapshot?.today?.revenue || 0)
        )}`;

        const pending = Number(
          snapshot?.attention?.pendingConfirmCount || 0
        );
        const disputes = Number(
          snapshot?.attention?.disputedCount || 0
        );
        const needs = pending + disputes;

        const checkin = {
          title: "Daily business check-in",
          lines: [
            todayLine,
            `Pending: ${pending} • Disputes: ${disputes}`,
            needs
              ? `Needs attention: ${needs} order(s)`
              : "Needs attention: none",
          ],
          suggestion: ai.suggestion,
          generatedAt: {
            dayKey: dk,
            timeZone: "Africa/Lagos",
            hour: 9,
          },
        };

        const nudges = (ai.nudges || [])
          .slice(0, 3)
          .map((n: any, idx: number) => ({
            id: `ai_${dk}_${idx + 1}`,
            tone: n.tone,
            title: n.title,
            body: n.body,
            cta: n.cta || null,
            source: "groq",
            dayKey: dk,
          }));

        await ref.set({
          ok: true,
          dayKey: dk,
          businessId,
          businessSlug: slug,
          checkin,
          nudges,
          createdAtMs: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
          source: "groq",
          model: "llama3-8b-8192",
        });

        created += 1;

        const pushBody = `${todayLine}. Tip: ${ai.suggestion}`.slice(0, 180);

        await sendBusinessPush({
          businessId,
          title: "myBizHub daily check-in (9am)",
          body: pushBody,
          url: "/vendor",
        }).then((r: any) => {
          pushed += Number(r?.sent || 0) > 0 ? 1 : 0;
        });

        const urgent = nudges.find((n: any) => n.tone === "warn");
        if (urgent) {
          await sendBusinessPush({
            businessId,
            title: urgent.title || "Action needed",
            body: String(urgent.body || "").slice(0, 180),
            url: urgent?.cta?.url || "/vendor/orders",
          }).catch(() => {});
        }
      } catch (e: any) {
        errors.push({
          businessId,
          error: e?.message || "Failed",
        });
      }
    }

    const nextCursor = businessDocs.length
      ? businessDocs[businessDocs.length - 1].id
      : null;

    return NextResponse.json({
      ok: true,
      dayKey: dk,
      processed: businessDocs.length,
      created,
      skipped,
      pushedBusinesses: pushed,
      nextCursor,
      errors: errors.slice(0, 20),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
