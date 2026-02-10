// FILE: src/app/api/public/store/[slug]/route.ts

import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSlug(v: any) {
  return String(v || "").trim().toLowerCase().slice(0, 80);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const s = cleanSlug(slug);

    if (!s) {
      return Response.json({ ok: false, error: "Missing slug" }, { status: 400 });
    }

    const snap = await adminDb
      .collection("businesses")
      .where("slug", "==", s)
      .limit(1)
      .get();

    if (snap.empty) {
      return Response.json({ ok: false, error: "Store not found" }, { status: 404 });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    // Build public store object (exclude sensitive fields)
    const store = {
      id: doc.id,
      slug: data.slug || s,
      name: data.name || s,
      description: data.description || "",
      logoUrl: data.logoUrl || "",
      bannerUrl: data.bannerUrl || "",
      whatsapp: data.whatsapp || "",
      instagram: data.instagram || "",
      state: data.state || "",
      city: data.city || "",
      
      // Bank/payout details for direct transfer
      payoutDetails: {
        bankName: data.payoutDetails?.bankName || data.payout?.bankName || "",
        accountNumber: data.payoutDetails?.accountNumber || data.payout?.accountNumber || "",
        accountName: data.payoutDetails?.accountName || data.payout?.accountName || data.name || "",
      },
      
      // Also include as 'payout' for backward compatibility
      payout: {
        bankName: data.payoutDetails?.bankName || data.payout?.bankName || "",
        accountNumber: data.payoutDetails?.accountNumber || data.payout?.accountNumber || "",
        accountName: data.payoutDetails?.accountName || data.payout?.accountName || data.name || "",
      },
    };

    return Response.json({ ok: true, store });
  } catch (e: any) {
    console.error("Public store fetch error:", e);
    return Response.json(
      { ok: false, error: e?.message || "Failed to load store" },
      { status: 500 }
    );
  }
}