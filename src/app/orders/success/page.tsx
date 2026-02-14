"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { Button } from "@/components/ui/Button";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();

  const reference = searchParams.get("tx_ref") || searchParams.get("reference");

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 text-center">
      <CheckCircle className="h-20 w-20 text-green-500 mb-6" />
      <h1 className="text-3xl font-bold text-gray-800">Payment Successful!</h1>
      <p className="mt-2 text-lg text-gray-600">Thank you for your order.</p>
      {reference && (
        <p className="mt-4 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
          Order Reference: <strong>{reference}</strong>
        </p>
      )}
      <p className="mt-4 text-gray-600">A receipt has been sent to your email address.</p>
      <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-xs">
        <Link href="/orders" className="w-full">
          <Button className="w-full">View My Orders</Button>
        </Link>
        <Link href="/market" className="w-full">
          <Button variant="secondary" className="w-full">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
