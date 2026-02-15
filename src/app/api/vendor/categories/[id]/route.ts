import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanName(v: any) { return String(v || "").trim().slice(0, 40); }
function slugify(name: string) {
  const s = String(name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return s || "category";
}
async function getStaffPerms(uid: string) {
  const uSnap = await adminDb.collection("users").doc(uid).get();
  const u = uSnap.exists ? (uSnap.data() as any) : {};
  const p = u?.staffPermissions && typeof u.staffPermissions === "object" ? u.staffPermissions : {};
  return { productsView: !!p.productsView, productsManage: !!p.productsManage };
}
async function assertOwned(me: any, id: string) {
  const ref = adminDb.collection("businessCategories").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ref, data: null as any };
  const data = { id: snap.id, ...(snap.data() as any) };
  if (!me.businessId || String(data.businessId || "") !== String(me.businessId || "")) throw new Error("Not allowed");
  return { ref, data };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner","staff"]);
    if (!me.businessId) return Response.json({ ok:false, error:"Missing businessId" }, { status:400 });
    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsManage) return Response.json({ ok:false, error:"Not authorized" }, { status:403 });
    }

    const { id } = await ctx.params;
    const { ref, data } = await assertOwned(me, String(id || ""));
    if (!data) return Response.json({ ok:false, error:"Not found" }, { status:404 });

    const body = await req.json().catch(() => ({}));
    const name = cleanName(body?.name);
    if (!name) return Response.json({ ok:false, error:"name is required" }, { status:400 });

    const existing = await adminDb.collection("businessCategories").where("businessId","==",me.businessId).limit(200).get();
    const slugs = new Set(existing.docs.filter((d)=>d.id!==ref.id).map((d)=>String((d.data() as any)?.slug || "")));
    const base = slugify(name);
    let slug = base;
    for (let i=2; slugs.has(slug); i++) { slug = (base + "-" + i).slice(0,40); if (i>50) break; }

    await ref.set({ name, nameLower: name.toLowerCase(), slug, updatedAt: FieldValue.serverTimestamp() }, { merge:true });
    return Response.json({ ok:true, id: ref.id, name, slug });
  } catch (e:any) {
    return Response.json({ ok:false, error: e?.message || "Failed" }, { status:500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner","staff"]);
    if (!me.businessId) return Response.json({ ok:false, error:"Missing businessId" }, { status:400 });
    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsManage) return Response.json({ ok:false, error:"Not authorized" }, { status:403 });
    }

    const { id } = await ctx.params;
    const catId = String(id || "").trim();
    const { ref, data } = await assertOwned(me, catId);
    if (!data) return Response.json({ ok:false, error:"Not found" }, { status:404 });

    // Unassign products (avoid composite indexes: fetch by businessId then filter)
    for (let loops = 0; loops < 6; loops++) {
      const snap = await adminDb.collection("products").where("businessId","==",me.businessId).limit(500).get();
      if (snap.empty) break;
      const hit = snap.docs.filter((d) => String((d.data() as any)?.categoryId || "") === catId);
      if (!hit.length) break;
      const batch = adminDb.batch();
      hit.forEach((d) => batch.set(d.ref, { categoryId: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
      await batch.commit();
      if (hit.length < 500) break;
    }

    await ref.delete();
    return Response.json({ ok:true });
  } catch (e:any) {
    return Response.json({ ok:false, error: e?.message || "Failed" }, { status:500 });
  }
}