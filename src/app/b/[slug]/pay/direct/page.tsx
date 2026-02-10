// FILE: src/app/b/[slug]/pay/direct/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Copy,
  Check,
  Upload,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  User,
  CreditCard,
  MessageCircle,
  ArrowRight,
  Camera,
  X,
  Phone,
} from "lucide-react";

import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { useCart } from "@/lib/cart/CartContext";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";

function fmtNaira(n: number) {
  return `₦${Number(n || 0).toLocaleString("en-NG")}`;
}

function digitsOnly(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

type Step = "details" | "transfer" | "proof" | "complete";

interface VendorBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  whatsapp: string;
  storeName: string;
}

export default function DirectTransferPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String((params as any)?.slug ?? "");

  const { cart, subtotal, clearCart } = useCart();

  // Customer details from URL or empty
  const [customerName, setCustomerName] = useState(searchParams.get("name") || "");
  const [customerPhone, setCustomerPhone] = useState(searchParams.get("phone") || "");
  const [customerEmail, setCustomerEmail] = useState(searchParams.get("email") || "");

  // Vendor data
  const [vendorData, setVendorData] = useState<VendorBankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow state
  const [step, setStep] = useState<Step>("details");
  const [copied, setCopied] = useState<string | null>(null);

  // Proof upload
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Order
  const [orderId, setOrderId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Amount from URL or cart
  const amount = useMemo(() => {
    const urlAmount = searchParams.get("amount");
    if (urlAmount) return Number(urlAmount) || 0;
    return subtotal || 0;
  }, [searchParams, subtotal]);

  const validCart = cart.storeSlug === slug && cart.items.length > 0;
  const hasAmount = amount > 0;

  // Fetch vendor bank details
  useEffect(() => {
    async function fetchVendor() {
      setLoading(true);
      setError(null);

      try {
        // Try the public store API first
        const r = await fetch(`/api/public/store/${encodeURIComponent(slug)}`);
        const json = await r.json().catch(() => ({}));

        if (!r.ok) {
          throw new Error(json.error || "Could not load vendor details");
        }

        const store = json.store || json;

        // Check both possible locations for bank details
        const payout = store.payoutDetails || store.payout || {};
        const bankName = payout.bankName || "";
        const accountNumber = payout.accountNumber || "";
        const accountName = payout.accountName || store.name || slug;
        const whatsapp = store.whatsapp || "";
        const storeName = store.name || slug;

        setVendorData({
          bankName,
          accountNumber,
          accountName,
          whatsapp,
          storeName,
        });
      } catch (e: any) {
        setError(e.message || "Failed to load vendor details");
      } finally {
        setLoading(false);
      }
    }

    if (slug) fetchVendor();
  }, [slug]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Please select an image or PDF file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB");
      return;
    }

    setProofFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProofPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  }, []);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  // Create order
  const createOrder = useCallback(async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }

    setCreating(true);

    try {
      const payload = {
        storeSlug: slug,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        items: validCart ? cart.items : [],
        totalAmountKobo: Math.round(amount * 100),
        paymentMethod: "direct_transfer",
      };

      const r = await fetch("/api/orders/direct/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(json.error || "Failed to create order");
      }

      const newOrderId = json.orderId;
      setOrderId(newOrderId);

      // Clear cart after successful order
      if (validCart) {
        clearCart();
      }

      toast.success("Order created!");
      setStep("transfer");
    } catch (e: any) {
      toast.error(e.message || "Failed to create order");
    } finally {
      setCreating(false);
    }
  }, [slug, customerName, customerPhone, customerEmail, validCart, cart.items, amount, clearCart]);

  // Send proof via WhatsApp
  const sendViaWhatsApp = useCallback(() => {
    if (!vendorData?.whatsapp) {
      toast.error("Vendor hasn't set up WhatsApp");
      return;
    }

    const phone = digitsOnly(vendorData.whatsapp);
    const message = [
      `🏦 *DIRECT TRANSFER PROOF*`,
      ``,
      `Hi ${vendorData.storeName}!`,
      ``,
      `I just transferred *${fmtNaira(amount)}* to your account.`,
      ``,
      `📋 *Order Details:*`,
      `• Order ID: ${orderId || "Pending"}`,
      `• Customer: ${customerName}`,
      `• Phone: ${customerPhone}`,
      ``,
      `I'm sending my payment screenshot in this chat.`,
      ``,
      `Please confirm receipt. Thank you! 🙏`,
    ].join("\n");

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");

    toast.success("Opening WhatsApp...");
    setStep("complete");
  }, [vendorData, amount, orderId, customerName, customerPhone]);

  // Upload proof to server (optional - for record keeping)
  const uploadProof = useCallback(async () => {
    if (!proofFile || !orderId) {
      sendViaWhatsApp();
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("customerPhone", customerPhone);
      formData.append("customerEmail", customerEmail);

      const r = await fetch(`/api/public/orders/${encodeURIComponent(orderId)}/transfer-proof`, {
        method: "POST",
        body: formData,
      });

      if (!r.ok) {
        // Even if upload fails, still send to WhatsApp
        console.error("Proof upload failed, continuing to WhatsApp");
      }
    } catch (e) {
      console.error("Proof upload error:", e);
    } finally {
      setUploading(false);
      sendViaWhatsApp();
    }
  }, [proofFile, orderId, customerPhone, customerEmail, sendViaWhatsApp]);

  // Check if bank details are set
  const hasBankDetails = vendorData?.accountNumber && vendorData?.bankName;

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Direct Transfer" showBack={true} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <span className="ml-3 text-gray-500">Loading vendor details...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Direct Transfer" showBack={true} />
        <div className="px-4 pt-4">
          <Card className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-900">Something went wrong</p>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
            <Button className="mt-6" onClick={() => router.back()}>
              Go Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Render no bank details state
  if (!hasBankDetails) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Direct Transfer" showBack={true} />
        <div className="px-4 pt-4">
          <Card className="p-6 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-900">Bank Transfer Unavailable</p>
            <p className="text-sm text-gray-500 mt-2">
              This vendor hasn't added their bank account details yet.
              Please use card payment or contact them directly.
            </p>
            <div className="mt-6 space-y-2">
              <Button onClick={() => router.back()}>
                Use Card Payment
              </Button>
              {vendorData?.whatsapp && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const phone = digitsOnly(vendorData.whatsapp);
                    window.open(`https://wa.me/${phone}`, "_blank");
                  }}
                  leftIcon={<MessageCircle className="w-4 h-4" />}
                >
                  Contact on WhatsApp
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <GradientHeader
        title="Direct Transfer"
        subtitle={`Pay ${vendorData.storeName}`}
        showBack={true}
      />

      <div className="px-4 space-y-4 mt-4">
        {/* Amount Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg">
          <p className="text-sm font-medium text-orange-100">Amount to Transfer</p>
          <p className="text-4xl font-black mt-2 tracking-tight">{fmtNaira(amount)}</p>
          <p className="text-sm text-orange-100 mt-2">
            Transfer exact amount • Include your name in narration
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-2">
          {[
            { key: "details", label: "Details", icon: User },
            { key: "transfer", label: "Transfer", icon: Building2 },
            { key: "proof", label: "Proof", icon: Camera },
            { key: "complete", label: "Done", icon: Check },
          ].map((s, i, arr) => {
            const Icon = s.icon;
            const isActive = step === s.key;
            const isPast = arr.findIndex((x) => x.key === step) > i;

            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      isActive
                        ? "bg-orange-500 text-white"
                        : isPast
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-400"
                    )}
                  >
                    {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <p
                    className={cn(
                      "text-[10px] font-medium mt-1",
                      isActive ? "text-orange-600" : isPast ? "text-green-600" : "text-gray-400"
                    )}
                  >
                    {s.label}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={cn(
                      "w-8 h-0.5 mx-1",
                      isPast ? "bg-green-500" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Customer Details */}
        {step === "details" && (
          <SectionCard title="Your Details" subtitle="We'll notify you when payment is confirmed">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Full Name *
                </label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Phone Number *
                </label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08012345678"
                  type="tel"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Email (optional)
                </label>
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="your@email.com"
                  type="email"
                />
              </div>

              <Button
                onClick={createOrder}
                disabled={!customerName.trim() || !customerPhone.trim() || creating}
                loading={creating}
                className="w-full mt-4"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Bank Details
              </Button>
            </div>
          </SectionCard>
        )}

        {/* Step 2: Bank Details */}
        {step === "transfer" && (
          <>
            <SectionCard title="Bank Account Details" subtitle="Transfer to this account">
              <div className="space-y-3">
                {/* Bank Name */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Bank Name
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {vendorData.bankName}
                      </p>
                    </div>
                    <Building2 className="w-6 h-6 text-gray-400" />
                  </div>
                </div>

                {/* Account Number */}
                <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">
                        Account Number
                      </p>
                      <p className="text-2xl font-black text-gray-900 mt-1 tracking-wider">
                        {vendorData.accountNumber}
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(vendorData.accountNumber, "Account number")}
                      className={cn(
                        "p-3 rounded-xl transition-all",
                        copied === "Account number"
                          ? "bg-green-500 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                      )}
                    >
                      {copied === "Account number" ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Account Name */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Account Name
                      </p>
                      <p className="text-base font-bold text-gray-900 mt-1">
                        {vendorData.accountName}
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(vendorData.accountName, "Account name")}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        copied === "Account name"
                          ? "bg-green-500 text-white"
                          : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      {copied === "Account name" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tip */}
              <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Pro tip</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Add "{customerName}" as your transfer narration so the vendor can identify your payment quickly.
                  </p>
                </div>
              </div>
            </SectionCard>

            <Button
              onClick={() => setStep("proof")}
              className="w-full"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              I've Made the Transfer
            </Button>
          </>
        )}

        {/* Step 3: Upload Proof */}
        {step === "proof" && (
          <>
            <SectionCard title="Payment Proof" subtitle="Upload screenshot or send via WhatsApp">
              <div className="space-y-4">
                {/* File Upload Area */}
                <div
                  className={cn(
                    "rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer",
                    proofFile
                      ? "border-green-300 bg-green-50"
                      : "border-gray-300 bg-gray-50 hover:border-orange-300 hover:bg-orange-50"
                  )}
                  onClick={() => document.getElementById("proof-input")?.click()}
                >
                  <input
                    id="proof-input"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {proofPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={proofPreview}
                        alt="Payment proof"
                        className="max-h-40 rounded-xl mx-auto"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProofFile(null);
                          setProofPreview(null);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : proofFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">{proofFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(proofFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700">
                        Tap to upload screenshot
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG or PDF • Max 10MB
                      </p>
                    </>
                  )}
                </div>

                {/* WhatsApp Send Button */}
                <Button
                  onClick={uploadProof}
                  loading={uploading}
                  disabled={uploading}
                  className="w-full bg-green-600 hover:bg-green-700"
                  leftIcon={<MessageCircle className="w-5 h-5" />}
                >
                  {proofFile ? "Send Proof via WhatsApp" : "Notify Vendor on WhatsApp"}
                </Button>

                <p className="text-xs text-center text-gray-500">
                  {proofFile
                    ? "Your screenshot will be sent to the vendor's WhatsApp"
                    : "You can also send your payment screenshot directly on WhatsApp"}
                </p>
              </div>
            </SectionCard>
          </>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>

            <h2 className="text-xl font-bold text-gray-900">Payment Notification Sent!</h2>
            <p className="text-sm text-gray-500 mt-2">
              The vendor has been notified via WhatsApp. They will confirm your payment and process your order.
            </p>

            {orderId && (
              <div className="mt-4 rounded-xl bg-gray-100 p-4">
                <p className="text-xs text-gray-500">Order Reference</p>
                <p className="text-sm font-mono font-bold text-gray-900 mt-1">{orderId}</p>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {orderId && (
                <Button
                  onClick={() => router.push(`/orders/${orderId}`)}
                  className="w-full"
                >
                  View Order Status
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => router.push(`/b/${slug}`)}
                className="w-full"
              >
                Back to Store
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}