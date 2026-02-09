"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/Card";
import GradientHeader from "@/components/GradientHeader";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/lib/cart/CartContext";
import { toast } from "@/lib/ui/toast";
import { Copy, CheckCircle } from "lucide-react";

function fmtNaira(n: number) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

export default function DirectPayPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String((params as any)?.slug ?? "");
  const { cart, subtotal, clearCart } = useCart();

  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // We need to fetch the vendor's bank details so the buyer knows where to send the money
  useEffect(() => {
    async function fetchVendorBank() {
      try {
        const r = await fetch(`/api/public/store/${encodeURIComponent(slug)}`);
        const json = await r.json();
        
        if (!r.ok) throw new Error(json.error || "Could not load vendor details.");
        
        // Grab the payout bank details from the public profile
        setVendorData(json.store);
      } catch (e: any) {
        setMsg(e.message || "Could not load vendor bank details.");
      } finally {
        setLoading(false);
      }
    }
    
    if (slug) fetchVendorBank();
  }, [slug]);

  // If the cart is empty or wrong store, send them back
  if (cart.storeSlug !== slug || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-sm">
          <p className="font-bold text-gray-800">Your cart is empty.</p>
          <Button className="mt-4 w-full" onClick={() => router.push(`/b/${slug}`)}>Return to Store</Button>
        </Card>
      </div>
    );
  }

  const bankName = vendorData?.payout?.bankName || "No Bank Name Listed";
  const acctNum = vendorData?.payout?.accountNumber || "No Account Listed";
  const acctName = vendorData?.payout?.accountName || vendorData?.name || slug;
  
  // They can't pay if the vendor hasn't set up their bank!
  const bankMissing = !vendorData?.payout?.accountNumber;

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Account number copied!");
    } catch {
      toast.error("Failed to copy.");
    }
  }

  async function confirmPayment() {
    setConfirming(true);
    setMsg(null);

    try {
      // 1. We create the order in the database marked as "awaiting_confirmation"
      const payload = {
        storeSlug: slug,
        customerName: searchParams.get("name") || "Customer",
        customerPhone: searchParams.get("phone") || "",
        items: cart.items,
        totalAmountKobo: subtotal * 100,
        paymentMethod: "direct_transfer",
      };

      const r = await fetch("/api/orders/direct/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to confirm payment.");

      // 2. Clear their cart because they "checked out"
      clearCart();

      // 3. Send them to the Success Page!
      toast.success("Order submitted to vendor!");
      router.push(`/order/success?status=completed&tx_ref=${json.orderId || "direct_" + Date.now()}`);
      
    } catch (e: any) {
      setMsg(e.message || "Something went wrong.");
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GradientHeader title="Bank Transfer" subtitle={`Pay ${acctName}`} showBack={true} />

      <div className="px-4 pb-24 space-y-4 pt-4 max-w-lg mx-auto">
        {loading ? (
          <Card className="p-4 text-center text-gray-500 font-bold">Loading bank details...</Card>
        ) : msg ? (
          <Card className="p-4 text-center text-red-600 font-bold">{msg}</Card>
        ) : bankMissing ? (
          <Card className="p-6 text-center">
            <p className="font-bold text-gray-800 text-lg">Bank Transfer Unavailable</p>
            <p className="text-sm text-gray-500 mt-2">
              This vendor has not added their bank account details yet. Please use Card Payment or contact them on WhatsApp.
            </p>
            <Button className="mt-6 w-full" onClick={() => router.back()}>Go Back</Button>
          </Card>
        ) : (
          <>
            {/* INSTRUCTIONS */}
            <div className="text-center">
              <p className="text-2xl font-black text-black">{fmtNaira(subtotal)}</p>
              <p className="text-sm text-gray-500 mt-1">Please transfer the exact amount above to the vendor's account below.</p>
            </div>

            {/* BANK DETAILS CARD */}
            <Card className="p-6 border-2 border-biz-accent/20 bg-white">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bank Name</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{bankName}</p>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Account Name</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{acctName}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Account Number</p>
                  <div className="flex items-center justify-between mt-1 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <p className="text-xl font-black text-biz-accent tracking-widest">{acctNum}</p>
                    <button 
                      onClick={() => copyToClipboard(acctNum)}
                      className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition shadow-sm"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* CONFIRMATION BUTTON */}
            <Card className="p-4 bg-orange-50 border border-orange-100">
              <p className="text-xs text-orange-800 text-center font-bold mb-4 leading-relaxed">
                Only click the button below AFTER you have successfully transferred the money. The vendor will verify the transfer before shipping your order.
              </p>
              <Button 
                onClick={confirmPayment} 
                disabled={confirming} 
                loading={confirming}
                className="w-full bg-black text-white hover:bg-gray-800 h-14"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                I have sent the money
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}