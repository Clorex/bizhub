
import { buildQuote } from "@/lib/checkout/pricingServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const storeSlug = String(body.storeSlug || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const couponCode = body.couponCode != null ? String(body.couponCode) : null;
    const shippingFeeKobo = body.shippingFeeKobo != null ? Number(body.shippingFeeKobo) : 0;

    const q = await buildQuote({
      storeSlug,
      items,
      couponCode,
      shippingFeeKobo,
    });

    return Response.json({ ok: true, ...q });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed to quote" }, { status: 400 });
  }
}