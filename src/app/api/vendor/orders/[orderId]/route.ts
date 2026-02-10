
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/orders/[orderId]
 * Fetch a single order for the authenticated vendor
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return Response.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Get user's business ID
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (!userData?.businessId) {
      return Response.json(
        { error: "No business found" },
        { status: 403 }
      );
    }

    const businessId = userData.businessId;

    // Fetch the order
    const orderDoc = await adminDb.collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      return Response.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const orderData = orderDoc.data();

    // Verify this order belongs to the vendor's business
    if (orderData?.businessId !== businessId) {
      return Response.json(
        { error: "Not authorized to view this order" },
        { status: 403 }
      );
    }

    const order = {
      id: orderDoc.id,
      ...orderData,
    };

    return Response.json({ ok: true, order });
  } catch (error: any) {
    console.error("[GET /api/vendor/orders/[orderId]]", error);
    return Response.json(
      { error: error.message || "Failed to fetch order" },
      { status: 500 }
    );
  }
}
