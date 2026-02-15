import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSlug(v: any) { return String(v || "").trim().toLowerCase().slice(0, 80); }

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const s = cleanSlug(slug);
    if (!s) return Response.json({ ok:false, error:"Missing slug" }, { status:400 });

    const bizSnap = await adminDb.collection("businesses").where("slug","==",s).limit(1).get();
    if (bizSnap.empty) return Response.json({ ok:false, error:"Store not found" }, { status:404 });
    const businessId = bizSnap.docs[0].id;

    const snap = await adminDb.collection("businessCategories").where("businessId","==",businessId).limit(200).get();
    const categories = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .map((c) => ({ id: c.id, name: String(c.name||""), slug: String(c.slug||"") }))
      .sort((a,b) => a.name.localeCompare(b.name));

    return Response.json({ ok:true, businessId, categories });
  } catch (e:any) {
    return Response.json({ ok:false, error: e?.message || "Failed" }, { status:500 });
  }
}