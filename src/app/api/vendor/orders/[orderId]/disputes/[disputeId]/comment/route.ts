
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

/**
 * POST /api/vendor/orders/[orderId]/disputes/[disputeId]/comment
 * Add a comment/response to a dispute
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string; disputeId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { orderId, disputeId } = await params;

    if (!orderId || !disputeId) {
      return Response.json(
        { error: "Order ID and Dispute ID are required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { text, attachments } = body;

    if (!text?.trim() && (!attachments || attachments.length === 0)) {
      return Response.json(
        { error: "Comment text or attachments are required" },
        { status: 400 }
      );
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (!userData?.businessId) {
      return Response.json({ error: "No business found" }, { status: 403 });
    }

    const businessId = userData.businessId;

    const orderDoc = await adminDb.collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const orderData = orderDoc.data();

    if (orderData?.businessId !== businessId) {
      return Response.json(
        { error: "Not authorized to comment on this dispute" },
        { status: 403 }
      );
    }

    const disputeRef = adminDb.collection("disputes").doc(disputeId);
    const disputeDoc = await disputeRef.get();

    if (!disputeDoc.exists) {
      return Response.json({ error: "Dispute not found" }, { status: 404 });
    }

    const disputeData = disputeDoc.data();

    if (disputeData?.orderId !== orderId) {
      return Response.json(
        { error: "Dispute does not belong to this order" },
        { status: 400 }
      );
    }

    const status = String(disputeData?.status || "open").toLowerCase();
    if (status === "resolved" || status === "closed") {
      return Response.json(
        { error: "Cannot add comments to a resolved or closed dispute" },
        { status: 400 }
      );
    }

    const comment = {
      author: "vendor",
      authorId: uid,
      text: String(text || "").trim(),
      attachments: Array.isArray(attachments) ? attachments.slice(0, 5) : [],
      createdAt: FieldValue.serverTimestamp(),
    };

    await disputeRef.update({
      comments: FieldValue.arrayUnion(comment),
      updatedAt: FieldValue.serverTimestamp(),
      lastCommentBy: "vendor",
      lastCommentAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("activityLog").add({
      type: "dispute_comment_added",
      disputeId,
      orderId,
      businessId,
      uid,
      author: "vendor",
      timestamp: FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      message: "Comment added successfully",
    });
  } catch (error: any) {
    console.error("[POST /api/vendor/orders/[orderId]/disputes/[disputeId]/comment]", error);
    return Response.json(
      { error: error.message || "Failed to add comment" },
      { status: 500 }
    );
  }
}