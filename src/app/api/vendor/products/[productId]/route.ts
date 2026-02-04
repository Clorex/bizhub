import { NextResponse, type NextRequest } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

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

function cleanListingType(v: any): "product" | "service" {
  return String(v || "product") === "service" ? "service" : "product";
}

function cleanServiceMode(v: any): "book" | "pay" {
  return String(v || "book") === "pay" ? "pay" : "book";
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

async function getOwnedProduct(me: any, productId: string) {
  const ref = adminDb.collection("products").doc(productId);
  const snap = await ref.get();
  if (!snap.exists) return { ref, data: null as any };

  const data = { id: snap.id, ...snap.data() } as any;

  if (!me.businessId || data.businessId !== me.businessId) {
    throw new Error("Not allowed");
  }

  return { ref, data };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
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

    const { productId } = await ctx.params;
    const productIdClean = String(productId || "");
    const { data } = await getOwnedProduct(me, productIdClean);
    if (!data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    if (typeof data.marketEnabled === "undefined") data.marketEnabled = true;
    if (!data.listingType) data.listingType = "product";
    if (Array.isArray(data.images)) data.images = cleanImages(data.images);

    return NextResponse.json({ ok: true, product: data });
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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
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

    const { productId } = await ctx.params;
    const productIdClean = String(productId || "");
    const { ref, data: existing } = await getOwnedProduct(me, productIdClean);
    if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));

    const listingType = cleanListingType(body.listingType ?? existing.listingType ?? "product");
    const serviceMode = cleanServiceMode(body.serviceMode ?? existing.serviceMode ?? "book");

    const name = String(body.name ?? existing.name ?? "").trim();
    const description = String(body.description ?? existing.description ?? "");
    const price = Number(body.price ?? existing.price ?? 0);
    const stock = Number(body.stock ?? existing.stock ?? 0);
    const packaging = String(body.packaging ?? existing.packaging ?? "Box");

    if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

    if (listingType === "product") {
      if (!(price > 0)) return NextResponse.json({ ok: false, error: "price must be > 0 for products" }, { status: 400 });
    } else {
      if (serviceMode === "pay" && !(price > 0)) {
        return NextResponse.json({ ok: false, error: "price must be > 0 for pay-to-book services" }, { status: 400 });
      }
    }

    const images = cleanImages(typeof body.images !== "undefined" ? body.images : Array.isArray(existing.images) ? existing.images : []);
    const optionGroups = Array.isArray(body.optionGroups)
      ? body.optionGroups
      : Array.isArray(existing.optionGroups)
        ? existing.optionGroups
        : [];

    const marketEnabled = body.marketEnabled === false ? false : true;

    const update: any = {
      listingType,
      serviceMode: listingType === "service" ? serviceMode : null,

      name,
      nameLower: name.toLowerCase(),
      description,

      price: Number.isFinite(price) ? price : 0,
      stock: listingType === "product" ? (Number.isFinite(stock) ? stock : 0) : 0,

      packaging,
      images,
      optionGroups,
      marketEnabled,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (String(existing.name || "") !== name) update.keywords = keywordsFor(name);

    await ref.set(update, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
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

    const { productId } = await ctx.params;
    const productIdClean = String(productId || "");
    const { ref, data } = await getOwnedProduct(me, productIdClean);
    if (!data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Delete failed" }, { status: 500 });
  }
}