import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGES = 10;

function cleanImages(input: any) {
  const arr = Array.isArray(input) ? input : [];
  const urls = arr
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .filter((u) => u.startsWith("http://") || u.startsWith("https://"));

  return Array.from(new Set(urls)).slice(0, MAX_IMAGES);
}

function keywordsFor(name: string) {
  const n = name.toLowerCase().trim();
  const parts = n.split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    out.add(p);
    for (let i = 2; i <= Math.min(10, p.length); i++) out.add(p.slice(0, i));
  }
  return Array.from(out).slice(0, 40);
}

async function getStaffPerms(uid: string) {
  const uSnap = await adminDb.collection("users").doc(uid).get();
  const u = uSnap.exists ? (uSnap.data() as any) : {};
  const p = u?.staffPermissions && typeof u.staffPermissions === "object" ? u.staffPermissions : {};
  return {
    productsView: !!p.productsView,
    productsManage: !!p.productsManage,
  };
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsView && !perms.productsManage) {
        return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
      }
    }

    const snap = await adminDb.collection("products").where("businessId", "==", me.businessId).limit(200).get();
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ ok: true, products });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsManage) {
        return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
      }
    }

    // plan-config driven limits
    const plan = await getBusinessPlanResolved(me.businessId);
    const maxProducts = Number(plan?.limits?.maxProducts || 0);

    if (!Number.isFinite(maxProducts) || maxProducts <= 0) {
      return NextResponse.json(
        { ok: false, code: "PLAN_LIMIT_PRODUCTS", error: "Your plan does not allow creating products." },
        { status: 403 }
      );
    }

    const agg = await adminDb.collection("products").where("businessId", "==", me.businessId).count().get();
    const currentCount = Number((agg.data() as any)?.count || 0);

    if (currentCount >= maxProducts) {
      return NextResponse.json(
        {
          ok: false,
          code: "PLAN_LIMIT_PRODUCTS",
          error: `You have reached your listing limit (${maxProducts}). Upgrade to add more.`,
          limit: maxProducts,
          current: currentCount,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // ✅ SERVICES REMOVED: force product-only
    const listingType: "product" = "product";

    const name = String(body.name || "").trim();
    const description = String(body.description || "");
    const price = Number(body.price || 0);
    const stock = Number(body.stock ?? 0);
    const packaging = String(body.packaging || "Box");

    if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    if (!(price > 0)) return NextResponse.json({ ok: false, error: "price must be > 0" }, { status: 400 });

    const images = cleanImages(body.images);
    const optionGroups = Array.isArray(body.optionGroups) ? body.optionGroups : [];
    const marketEnabled = body.marketEnabled === false ? false : true;

    // Marketplace flags stored on product for /market filtering
    const biz = plan.business || {};
    const marketAllowed = !!plan.features?.marketplace;
    const businessHasActiveSubscription = !!plan.hasActiveSubscription;

    const ref = adminDb.collection("products").doc();
    await ref.set({
      businessId: me.businessId,
      businessSlug: plan?.business?.slug ?? me.businessSlug ?? null,

      businessState: biz?.state ?? null,
      businessCity: biz?.city ?? null,

      marketAllowed,
      businessHasActiveSubscription,
      marketTier: Number(biz?.verificationTier || 0),

      listingType,
      serviceMode: null, // legacy field kept as null

      name,
      nameLower: name.toLowerCase(),
      keywords: keywordsFor(name),

      description,
      price: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) ? stock : 0,

      packaging,
      images,
      optionGroups,
      marketEnabled,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, productId: ref.id });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Create failed" }, { status: 500 });
  }
}