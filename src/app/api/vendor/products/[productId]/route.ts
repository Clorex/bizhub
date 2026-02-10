// FILE: src/app/api/vendor/products/[productId]/route.ts

import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
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

async function getOwnedProduct(me: any, productId: string) {
  const ref = adminDb.collection("products").doc(productId);
  const snap = await ref.get();
  if (!snap.exists) return { ref, data: null as any };
  const data = { id: snap.id, ...snap.data() } as any;
  if (!me.businessId || data.businessId !== me.businessId) throw new Error("Not allowed");
  return { ref, data };
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

export async function GET(req: Request, ctx: { params: Promise<{ productId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsView && !perms.productsManage) return Response.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const { productId } = await ctx.params;
    const { data } = await getOwnedProduct(me, String(productId || ""));
    if (!data) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    if (!data.coverAspect) data.coverAspect = "1:1";
    if (!Array.isArray(data.categoryKeys) || !data.categoryKeys.length) data.categoryKeys = ["other"];
    if (!data.attrs) data.attrs = { colors: [], sizes: [] };

    return Response.json({ ok: true, product: data });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ productId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    if (me.role === "staff") {
      const perms = await getStaffPerms(me.uid);
      if (!perms.productsManage) return Response.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const { productId } = await ctx.params;
    const { ref, data: existing } = await getOwnedProduct(me, String(productId || ""));
    if (!existing) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));

    const name = String(body.name ?? existing.name ?? "").trim();
    const description = String(body.description ?? existing.description ?? "");
    const price = Number(body.price ?? existing.price ?? 0);
    const stock = Number(body.stock ?? existing.stock ?? 0);
    const packaging = String(body.packaging ?? existing.packaging ?? "Box");

    if (!name) return Response.json({ ok: false, error: "name is required" }, { status: 400 });
    if (!(price > 0)) return Response.json({ ok: false, error: "price must be > 0" }, { status: 400 });

    const images = cleanImages(typeof body.images !== "undefined" ? body.images : existing.images);
    const optionGroups = Array.isArray(body.optionGroups) ? body.optionGroups : existing.optionGroups || [];
    const marketEnabled = body.marketEnabled === false ? false : true;

    const coverAspect = normalizeCoverAspect(body.coverAspect) ?? normalizeCoverAspect(existing.coverAspect) ?? "1:1";

    const colors = cleanListCsv(body.colorsCsv);
    const sizes = cleanListCsv(body.sizesCsv);

    let categoryKeys = cleanCategoryKeys(body.categoryKeys);
    if (!categoryKeys.length) categoryKeys = cleanCategoryKeys(existing.categoryKeys);
    if (!categoryKeys.length) categoryKeys = suggestCategoriesFromText(`${name} ${description}`, 3);

    const keywords = keywordsForProduct({ name, description, categoryKeys, colors, sizes });

    await ref.set(
      {
        name,
        nameLower: name.toLowerCase(),
        description,
        price: Number.isFinite(price) ? price : 0,
        stock: Number.isFinite(stock) ? stock : 0,
        packaging,
        images,
        optionGroups,
        marketEnabled,
        coverAspect,

        categoryKeys,
        attrs: { colors, sizes },
        keywords,

        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Update failed" }, { status: 500 });
  }
}