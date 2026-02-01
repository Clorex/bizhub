// FILE: src/app/api/orders/recent/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireMe } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function lowerEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);

    const body = await req.json().catch(() => ({}));
    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const ids = Array.from(new Set(idsRaw.map(String).filter(Boolean))).slice(0, 25);

    if (ids.length === 0) return NextResponse.json({ ok: true, orders: [] });

    // Build doc refs + fetch in batch
    const refs = ids.map((id) => adminDb.collection("orders").doc(id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snaps: any[] = await (adminDb as any).getAll(...refs);

    const myEmail = lowerEmail(me.email);

    const out: any[] = [];

    for (const s of snaps) {
      if (!s?.exists) continue;
      const o = { id: s.id, ...(s.data() as any) };

      // Same access logic as /api/orders/[orderId]
      if (me.role === "customer") {
        const orderEmail = lowerEmail(o?.customer?.email);
        if (!myEmail || !orderEmail || myEmail !== orderEmail) continue;
      }

      if (me.role === "owner" || me.role === "staff") {
        if (!me.businessId || String(o.businessId || "") !== String(me.businessId || "")) continue;
      }

      // admin allowed
      out.push({
        id: o.id,
        createdAt: o.createdAt ?? null,
        businessSlug: o.businessSlug ?? null,
        paymentType: o.paymentType ?? null,
        escrowStatus: o.escrowStatus ?? null,
        orderStatus: o.orderStatus ?? null,
        opsStatus: o.opsStatus ?? null,
        opsStatusEffective: o.opsStatusEffective ?? null,
        amount: o.amount ?? null,
        amountKobo: o.amountKobo ?? null,
        items: Array.isArray(o.items) ? o.items : [],
      });
    }

    return NextResponse.json({ ok: true, orders: out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 401 });
  }
}