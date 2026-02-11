"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";

type Mode = "customer" | "vendor";

export default function RegisterPage({ storeName }: { storeName?: string | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const nextFromUrl = sp.get("next");

  const [mode, setMode] = useState<Mode>("customer");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // vendor-only
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canCustomer = email.trim().length > 3 && password.length >= 6;
  const canVendor = canCustomer && businessName.trim().length > 1;

  const nextDefault = useMemo(() => {
    return mode === "vendor" ? "/vendor" : "/market";
  }, [mode]);

  async function register() {
    setLoading(true);
    setMsg(null);

    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing auth token");

      // create role doc depending on mode
      if (mode === "vendor") {
        const r = await fetch("/api/vendor/onboard", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            businessName: businessName.trim(),
            businessSlug: businessSlug.trim(),
          }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Vendor onboarding failed");
      } else {
        const r = await fetch("/api/customer/onboard", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Customer onboarding failed");
      }

      // send verification code
      await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const dest = nextFromUrl || nextDefault;
      router.push(`/account/verify?next=${encodeURIComponent(dest)}`);
    } catch (e: any) {
      setMsg(e?.message || "Register failed");
    } finally {
      setLoading(false);
    }
  }

  const headerTitle = storeName ? `Create Account for ${storeName}` : "Create Account";

  return (
    <div className="min-h-screen">
      <GradientHeader title={headerTitle} showBack={true} />

      <div className="px-4 pb-24">
        <Card className="p-4">
          <p className="text-base font-extrabold text-[#111827]">Continue as</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className={
                mode === "customer"
                  ? "rounded-2xl py-3 text-sm font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]"
                  : "rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
              }
              onClick={() => setMode("customer")}
              disabled={loading}
            >
              Customer
            </button>

            <button
              className={
                mode === "vendor"
                  ? "rounded-2xl py-3 text-sm font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]"
                  : "rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
              }
              onClick={() => setMode("vendor")}
              disabled={loading}
            >
              Vendor
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <input
              className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
              placeholder="Password (min 6)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            {mode === "vendor" ? (
              <>
                <div className="h-px bg-[#E7E7EE] my-2" />
                <input
                  className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
                  placeholder="Business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
                <input
                  className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
                  placeholder="Business slug (optional)"
                  value={businessSlug}
                  onChange={(e) => setBusinessSlug(e.target.value)}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Your store link will look like: <b>/b/your-store</b>
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-600 mt-1">
                Customers will only login when checking out.
              </p>
            )}
          </div>

          <button
            className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-50"
            onClick={register}
            disabled={loading || (mode === "vendor" ? !canVendor : !canCustomer)}
          >
            {loading ? "Creating..." : "Create account"}
          </button>

          {msg ? <p className="mt-3 text-sm text-red-700">{msg}</p> : null}
        </Card>
      </div>
    </div>
  );
}