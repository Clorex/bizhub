
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    await requireVendorUnlocked(me.businessId);

    const plan = await getBusinessPlanResolved(me.businessId);

    // include staff permissions for UI decisions (optional but useful)
    let staffPermissions: any = null;
    let staffJobTitle: string | null = null;

    if (me.role === "staff") {
      const uSnap = await adminDb.collection("users").doc(me.uid).get();
      const u = uSnap.exists ? (uSnap.data() as any) : {};
      staffPermissions = u?.staffPermissions || null;
      staffJobTitle = u?.staffJobTitle ? String(u.staffJobTitle) : null;
    }

    return Response.json({
      ok: true,
      role: me.role,
      businessId: me.businessId,
      businessSlug: plan?.business?.slug ?? me.businessSlug ?? null,

      planKey: String(plan?.planKey || "FREE").toUpperCase(),
      hasActiveSubscription: !!plan?.hasActiveSubscription,
      features: plan?.features || {},
      limits: plan?.limits || {},

      staff: me.role === "staff" ? { staffJobTitle, staffPermissions } : null,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }

    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}