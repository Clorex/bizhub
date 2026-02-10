
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { getEntitlement } from "@/lib/bizhubPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch {
    return 0;
  }
}

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();

    const bSnap = await adminDb.collection("businesses").limit(300).get();
    const businesses = bSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // search filter in memory (avoid Firestore composite index requirements)
    const filtered = q
      ? businesses.filter((b) => {
          const name = String(b.name || "").toLowerCase();
          const slug = String(b.slug || "").toLowerCase();
          return name.includes(q) || slug.includes(q);
        })
      : businesses;

    // attach owner email via users query (N+1; acceptable for admin list MVP)
    const out: any[] = [];
    for (const b of filtered.slice(0, 200)) {
      const uSnap = await adminDb
        .collection("users")
        .where("businessId", "==", b.id)
        .limit(1)
        .get();

      const ownerEmail = uSnap.empty ? null : String(uSnap.docs[0].data()?.email || "").trim() || null;

      const entitlement = getEntitlement({ trial: b.trial ?? null, subscription: b.subscription ?? null });

      out.push({
        id: b.id,
        name: b.name ?? null,
        slug: b.slug ?? null,
        ownerEmail,
        createdAtMs: toMs(b.createdAt),
        entitlement,
        trial: b.trial ?? null,
        subscription: b.subscription ?? null,
      });
    }

    // sort newest first
    out.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));

    return Response.json({ ok: true, vendors: out });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}