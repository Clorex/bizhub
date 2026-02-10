
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/orders/[orderId]/disputes
 * Fetch all disputes for a specific order
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { orderId } = await params;
    if (!orderId) {
      return Response.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Get user's business ID
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (!userData?.businessId) {
      return Response.json({ error: "No business found" }, { status: 403 });
    }

    const businessId = userData.businessId;

    // Verify the order belongs to this vendor
    const orderDoc = await adminDb.collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const orderData = orderDoc.data();

    if (orderData?.businessId !== businessId) {
      return Response.json({ error: "Not authorized to view disputes for this order" }, { status: 403 });
    }

    // Fetch all disputes for this order
    const disputesSnapshot = await adminDb
      .collection("disputes")
      .where("orderId", "==", orderId)
      .orderBy("createdAt", "desc")
      .get();

    const disputes = disputesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toMillis?.() || null,
        updatedAt: data.updatedAt?.toMillis?.() || null,
        resolvedAt: data.resolvedAt?.toMillis?.() || null,
        // Format comments timestamps
        comments: Array.isArray(data.comments)
          ? data.comments.map((c: any) => ({
              ...c,
              createdAt: c.createdAt?.toMillis?.() || null,
            }))
          : [],
      };
    });

    return Response.json({
      ok: true,
      disputes,
      count: disputes.length,
    });
  } catch (error: any) {
    console.error("[GET /api/vendor/orders/[orderId]/disputes]", error);
    return Response.json(
      { error: error.message || "Failed to fetch disputes" },
      { status: 500 }
    );
  }
}