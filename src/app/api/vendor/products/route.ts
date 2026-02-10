// FILE: src/app/api/vendor/products/route.ts

import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { normalizeCoverAspect } from "@/lib/products/coverAspect";
import { cleanListCsv, keywordsForProduct } from "@/lib/search/keywords";
import { suggestCategoriesFromText, type MarketCategoryKey } from "@/lib/search/marketTaxonomy";

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

async function getStaffPerms(uid: string) {
  const uSnap = await adminDb.collection("users").doc(uid).get();
  const u = uSnap.exists ? (uSnap.data() as any) : {};
  const p = u?.staffPermissions && typeof u.staffPermissions === "object" ? u.staffPermissions : {};
  return { productsView: !!p.productsView, productsManage: !!p.productsManage };
}

const CAT_KEYS: MarketCategoryKey[] = ["fashion", "phones", "beauty", "home", "bags", "services", "other"];

function cleanCategoryKeys(input: any): MarketCategoryKey[] {
  const raw = Array.isArray(input) ? input : [];
  const tmp = raw.map((x) => String(x || "").toLowerCase().trim()).filter(Boolean);
  const out: MarketCategoryKey[] = [];
  for (const k of tmp) {
    if ((CAT_KEYS as string[]).includes(k) && !out.includes(k as any)) out.push(k as any);
    if (out.length >= 3) break;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsView && !perms.productsManage) return Response.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const snap = await adminDb.collection("products").where("businessId", "==", me.businessId).limit(200).get();
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json({ ok: true, products });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsManage) return Response.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const plan = await getBusinessPlanResolved(me.businessId);
    const maxProducts = Number(plan?.limits?.maxProducts || 0);
    if (!Number.isFinite(maxProducts) || maxProducts <= 0) {
      return Response.json({ ok: false, code: "PLAN_LIMIT_PRODUCTS", error: "Your plan does not allow creating products." }, { status: 403 });
    }

    const agg = await adminDb.collection("products").where("businessId", "==", me.businessId).count().get();
    const currentCount = Number((agg.data() as any)?.count || 0);
    if (currentCount >= maxProducts) {
      return Response.json({ ok: false, code: "PLAN_LIMIT_PRODUCTS", error: `You have reached your listing limit (${maxProducts}). Upgrade to add more.` }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const name = String(body.name || "").trim();
    const description = String(body.description || "");
    const price = Number(body.price || 0);
    const stock = Number(body.stock ?? 0);
    const packaging = String(body.packaging || "Box");

    if (!name) return Response.json({ ok: false, error: "name is required" }, { status: 400 });
    if (!(price > 0)) return Response.json({ ok: false, error: "price must be > 0" }, { status: 400 });

    const images = cleanImages(body.images);
    const optionGroups = Array.isArray(body.optionGroups) ? body.optionGroups : [];
    const marketEnabled = body.marketEnabled === false ? false : true;

    const coverAspect = normalizeCoverAspect(body.coverAspect) ?? "1:1";

    // ✅ category + attrs
    const colors = cleanListCsv(body.colorsCsv);
    const sizes = cleanListCsv(body.sizesCsv);

    let categoryKeys = cleanCategoryKeys(body.categoryKeys);
    if (!categoryKeys.length) categoryKeys = suggestCategoriesFromText(`${name} ${description}`, 3);

    const keywords = keywordsForProduct({ name, description, categoryKeys, colors, sizes });

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

      listingType: "product",
      serviceMode: null,

      name,
      nameLower: name.toLowerCase(),
      description,

      keywords,
      categoryKeys,
      attrs: { colors, sizes },

      price: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) ? stock : 0,

      packaging,
      images,
      optionGroups,
      marketEnabled,

      coverAspect,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true, productId: ref.id });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    return Response.json({ ok: false, error: e?.message || "Create failed" }, { status: 500 });
  }
}