"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, ReceiptText, AlertTriangle, MessageCircle, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { Button } from "@/components/ui/Button";

function SuccessContent() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();

  // Flutterwave sends `tx_ref` and `status` in the URL params
  const txRef = searchParams.get("tx_ref");
  const status = searchParams.get("status");

  // Clear the cart if the payment was successful
  useEffect(() => {
    if (status === "successful" || status === "completed") {
      clearCart();
    }
  }, [status, clearCart]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 pt-16 pb-24 px-4 text-center">
      
      {/* SUCCESS HEADER */}
      <CheckCircle className="h-20 w-20 text-emerald-500 mb-6 drop-shadow-md" />
      <h1 className="text-3xl font-black text-gray-900 tracking-tight">Payment Successful!</h1>
      <p className="mt-2 text-sm text-gray-600 font-medium">Thank you for shopping on myBizHub.</p>
      
      {txRef && (
        <div className="mt-4 bg-white border border-gray-200 px-5 py-2.5 rounded-2xl shadow-sm inline-flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order Ref</span>
          <span className="text-sm font-mono font-bold text-biz-accent">{txRef}</span>
        </div>
      )}

      {/* PRIMARY ACTION: RECEIPT */}
      {txRef && (
        <div className="mt-8 w-full max-w-sm">
          <Link 
            href={`/receipt/${txRef}`} 
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-black text-white px-4 py-4 text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            <ReceiptText className="w-5 h-5" />
            View & Print Receipt
          </Link>
        </div>
      )}

      {/* SECONDARY ACTIONS: SUPPORT & DISPUTES */}
      <div className="mt-8 w-full max-w-sm text-left">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">Next Steps</p>
        
        <div className="space-y-3">
          
          {/* Continue Shopping */}
          <Link 
            href="/market" 
            className="flex items-center gap-3 w-full bg-white border border-gray-200 p-4 rounded-2xl hover:border-biz-accent transition-colors shadow-sm group"
          >
            <div className="bg-orange-50 p-2 rounded-xl group-hover:bg-orange-100 transition-colors">
              <ShoppingBag className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Continue Shopping</p>
              <p className="text-xs text-gray-500 mt-0.5">Browse more products in the market</p>
            </div>
          </Link>

          {/* Contact Vendor */}
          <button 
            onClick={() => alert("Check your receipt for the vendor's WhatsApp link!")}
            className="flex items-center gap-3 w-full bg-white border border-gray-200 p-4 rounded-2xl hover:border-emerald-500 transition-colors shadow-sm group text-left"
          >
            <div className="bg-emerald-50 p-2 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Contact the Vendor</p>
              <p className="text-xs text-gray-500 mt-0.5">Reach out regarding shipping & ETA</p>
            </div>
          </button>

          {/* Raise a Dispute */}
          <Link 
            href="/disputes/create" 
            className="flex items-center gap-3 w-full bg-white border border-gray-200 p-4 rounded-2xl hover:border-red-500 transition-colors shadow-sm group"
          >
            <div className="bg-red-50 p-2 rounded-xl group-hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Raise a Dispute</p>
              <p className="text-xs text-gray-500 mt-0.5">Report an issue with your payment or order</p>
            </div>
          </Link>

        </div>
      </div>

    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 font-bold">Loading order details...</div>}>
      <SuccessContent />
    </Suspense>
  );
}