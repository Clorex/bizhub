
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function unreadCountFast() {
  // Prefer aggregation count if available, else fallback to fetching unread docs
  try {
    const anyDb: any = adminDb as any;
    const q: any = anyDb.collection("adminNotifications").where("read", "==", false);
    if (typeof q.count === "function") {
      const snap = await q.count().get();
      return Number(snap?.data()?.count || 0);
    }
  } catch {
    // ignore fallback below
  }

  const snap = await adminDb
    .collection("adminNotifications")
    .where("read", "==", false)
    .limit(1000)
    .get();

  return snap.size;
}

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const url = new URL(req.url);
    const mode = String(url.searchParams.get("mode") || "");

    if (mode === "count") {
      const unreadCount = await unreadCountFast();
      return Response.json({ ok: true, unreadCount });
    }

    const snap = await adminDb
      .collection("adminNotifications")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const unreadCount = rows.reduce((s, r) => s + (!r.read ? 1 : 0), 0);

    return Response.json({ ok: true, unreadCount, notifications: rows });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(req, "admin");

    const body = (await req.json().catch(() => ({}))) as any;
    const action = String(body?.action || "").toLowerCase();

    if (action === "mark_read") {
      const id = String(body?.id || "").trim();
      if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 });

      await adminDb.collection("adminNotifications").doc(id).set(
        {
          read: true,
          readAtMs: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return Response.json({ ok: true });
    }

    if (action === "mark_all_read") {
      const snap = await adminDb
        .collection("adminNotifications")
        .where("read", "==", false)
        .limit(400)
        .get();

      const b = adminDb.batch();
      const now = Date.now();

      for (const d of snap.docs) {
        b.set(
          d.ref,
          {
            read: true,
            readAtMs: now,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      await b.commit();
      return Response.json({ ok: true, updated: snap.size });
    }

    return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}