// src/app/api/webhooks/flutterwave/route.ts
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { OrderReceiptEmail } from "@/components/emails/OrderReceiptEmail";

// Mark as dynamic to prevent static build attempts
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Initialize inside the function - not at top level
  const flutterwaveSecretHash = process.env.FLUTTERWAVE_SECRET_HASH || "";
  const resend = new Resend(process.env.RESEND_API_KEY);

  // 1. Verify the webhook signature for security
  const signature = req.headers.get("verif-hash");

  if (!signature || signature !== flutterwaveSecretHash) {
    console.warn("Flutterwave webhook: Invalid signature hash.");
    // We return 200 OK even for failed verification to prevent Flutterwave from retrying.
    // The important part is we don't process the data.
    return Response.json({ status: "invalid signature" });
  }

  const event = await req.json();

  // 2. We only care about successful charges
  if (event.event === "charge.completed" && event.data.status === "successful") {
    const { tx_ref: reference, amount, currency, created_at } = event.data;

    try {
      // 3. Idempotency: Check if we've already processed this order
      const orderRef = adminDb.collection("orders").doc(reference);
      const orderDoc = await orderRef.get();

      if (orderDoc.exists) {
        console.log(`Order ${reference} already processed. Acknowledging webhook.`);
        return Response.json({ status: "success", message: "Already processed" });
      }

      // 4. Get the rich metadata we saved in the "paymentSessions" collection
      const sessionRef = adminDb.collection("paymentSessions").doc(reference);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        console.error(`FATAL: Payment session not found for reference: ${reference}`);
        // Can't proceed without metadata, so we stop.
        return Response.json({ error: "Session not found" }, { status: 404 });
      }
      
      const metadata = sessionDoc.data()?.payload || {};

      // 5. Save the full order details to Firestore
      const orderData = {
        orderId: reference,
        status: "paid",
        paymentProvider: "flutterwave",
        paidAt: new Date(created_at),
        createdAt: FieldValue.serverTimestamp(),
        // All the rich data you sent comes from our session payload
        storeSlug: metadata.storeSlug,
        customer: metadata.customer,
        items: metadata.items,
        shipping: metadata.shipping,
        coupon: metadata.coupon,
        quote: metadata.quote,
        // The final amount confirmed by Flutterwave
        amountPaid: amount,
        currency,
      };

      await orderRef.set(orderData);
      console.log(`Successfully created order ${reference} in Firestore.`);

      // 6. Send the receipt email using the data from our session
      const { storeSlug, customer: orderCustomer, items, quote } = metadata;
      const storeDoc = await adminDb.collection("businesses").doc(storeSlug).get();
      const storeName = storeDoc.data()?.name || storeSlug;

      await resend.emails.send({
        from: `myBizHub <receipts@yourdomain.com>`, // IMPORTANT: Replace with your verified domain
        to: [orderCustomer.email],
        subject: `Your myBizHub Order Receipt for ${storeName}`,
        react: OrderReceiptEmail({
          orderId: reference,
          orderDate: new Date(created_at).toLocaleDateString("en-GB"),
          storeName,
          customerName: orderCustomer.fullName,
          customerEmail: orderCustomer.email,
          items,
          pricing: quote.pricing,
        }),
      });

      console.log(`Successfully sent receipt for order ${reference} to ${orderCustomer.email}.`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("Error processing Flutterwave webhook:", errorMessage);
      // Return 500 so Flutterwave might retry
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // 7. Acknowledge receipt of the event to Flutterwave
  return Response.json({ status: "success" });
}