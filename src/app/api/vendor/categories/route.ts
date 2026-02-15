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

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner","staff"]);
    if (!me.businessId) return Response.json({ ok:false, error:"Missing businessId" }, { status:400 });
    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsView && !perms.productsManage) return Response.json({ ok:false, error:"Not authorized" }, { status:403 });
    }

    const snap = await adminDb.collection("businessCategories").where("businessId","==",me.businessId).limit(200).get();
    const categories = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .map((c) => ({ id: c.id, name: String(c.name||""), slug: String(c.slug||"") }))
      .sort((a,b) => a.name.localeCompare(b.name));

    return Response.json({ ok:true, categories });
  } catch (e:any) {
    return Response.json({ ok:false, error: e?.message || "Failed" }, { status:500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner","staff"]);
    if (!me.businessId) return Response.json({ ok:false, error:"Missing businessId" }, { status:400 });
    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsManage) return Response.json({ ok:false, error:"Not authorized" }, { status:403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = cleanName(body?.name);
    if (!name) return Response.json({ ok:false, error:"name is required" }, { status:400 });

    const existing = await adminDb.collection("businessCategories").where("businessId","==",me.businessId).limit(200).get();
    const slugs = new Set(existing.docs.map((d) => String((d.data() as any)?.slug || "")));
    const base = slugify(name);
    let slug = base;
    for (let i=2; slugs.has(slug); i++) { slug = (base + "-" + i).slice(0,40); if (i>50) break; }

    const ref = adminDb.collection("businessCategories").doc();
    await ref.set({ businessId: me.businessId, name, nameLower: name.toLowerCase(), slug, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

    return Response.json({ ok:true, category: { id: ref.id, name, slug } });
  } catch (e:any) {
    return Response.json({ ok:false, error: e?.message || "Failed" }, { status:500 });
  }
}