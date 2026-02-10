
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

/**
 * POST /api/vendor/orders/[orderId]/status
 * Update the operational status of an order
 */
export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const { opsStatus } = body;

    // Validate status
    const validStatuses = [
      "new",
      "contacted",
      "paid",
      "in_transit",
      "delivered",
      "cancelled",
    ];

    if (!opsStatus || !validStatuses.includes(opsStatus)) {
      return Response.json(
        {
          error:
            "Invalid status. Must be one of: " + validStatuses.join(", "),
        },
        { status: 400 }
      );
    }

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
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

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
        { error: "Not authorized to modify this order" },
        { status: 403 }
      );
    }

    // Update the order
    const updateData = {
      opsStatus,
      opsStatusEffective: opsStatus,
      updatedAt: FieldValue.serverTimestamp(),
      opsStatusHistory: FieldValue.arrayUnion({
        status: opsStatus,
        timestamp: FieldValue.serverTimestamp(),
        updatedBy: uid,
      }),
    };

    await orderRef.update(updateData);

    // Log activity
    await adminDb.collection("activityLog").add({
      type: "order_status_updated",
      orderId,
      businessId,
      uid,
      opsStatus,
      timestamp: FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      message: "Order status updated successfully",
      opsStatus,
    });
  } catch (error: any) {
    console.error("[POST /api/vendor/orders/[orderId]/status]", error);
    return Response.json(
      { error: error.message || "Failed to update order status" },
      { status: 500 }
    );
  }
}
