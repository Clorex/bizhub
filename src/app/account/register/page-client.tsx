"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getFriendlyAuthError } from "@/lib/auth/friendlyError";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { AlertCircle, ArrowRight } from "lucide-react";

type Mode = "customer" | "vendor";

export default function RegisterPage({ storeName }: { storeName?: string | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const nextFromUrl = sp.get("next");

  const [mode, setMode] = useState<Mode>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [error, setError] = useState<{ message: string; showSignIn?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    try { setOrigin(window.location.origin); } catch { setOrigin(""); }
  }, []);

  const canCustomer = email.trim().length > 3 && password.length >= 6;
  const canVendor = canCustomer && businessName.trim().length > 1;

  const nextDefault = useMemo(() => {
    return mode === "vendor" ? "/vendor" : "/market";
  }, [mode]);

  async function register() {
    setLoading(true);
    setError(null);

    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing auth token");

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

      await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const dest = nextFromUrl || nextDefault;
      router.push(`/account/verify?next=${encodeURIComponent(dest)}`);
    } catch (e: any) {
      const friendly = getFriendlyAuthError(e);
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }

  const headerTitle = storeName ? `Create Account for ${storeName}` : "Create Account";

  const storeLinkExample = useMemo(() => {
    const s = businessSlug.trim() ? businessSlug.trim() : "your-store";
    const base = origin || "https://your-website.com";
    return `${base}/store/${s}`;
  }, [origin, businessSlug]);

  return (
    <div className="min-h-screen">
      <GradientHeader title={headerTitle} showBack={true} />

      <div className="px-4 pb-24">
        <Card className="p-4">
          <p className="text-base font-extrabold text-gray-900">Continue as</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className={mode === "customer"
                ? "rounded-2xl py-3 text-sm font-extrabold text-white bg-gradient-to-br from-orange-500 to-orange-600"
                : "rounded-2xl border border-gray-200 py-3 text-sm font-extrabold text-gray-700 hover:bg-gray-50"}
              onClick={() => setMode("customer")}
              disabled={loading}
            >
              Customer
            </button>
            <button
              className={mode === "vendor"
                ? "rounded-2xl py-3 text-sm font-extrabold text-white bg-gradient-to-br from-orange-500 to-orange-600"
                : "rounded-2xl border border-gray-200 py-3 text-sm font-extrabold text-gray-700 hover:bg-gray-50"}
              onClick={() => setMode("vendor")}
              disabled={loading}
            >
              Vendor
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <input
              className="w-full border border-gray-200 rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="w-full border border-gray-200 rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300"
              placeholder="Password (min 6)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            {mode === "vendor" && (
              <>
                <div className="h-px bg-gray-200 my-2" />
                <input
                  className="w-full border border-gray-200 rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300"
                  placeholder="Store name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
                <input
                  className="w-full border border-gray-200 rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300"
                  placeholder="Store link name (optional) e.g. sarahs-boutique"
                  value={businessSlug}
                  onChange={(e) => setBusinessSlug(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your store link: <b className="text-gray-700">{storeLinkExample}</b>
                </p>
              </>
            )}

            {mode === "customer" && (
              <p className="text-xs text-gray-500 mt-1">
                Customers login when checking out.
              </p>
            )}
          </div>

          <button
            className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 disabled:opacity-50 transition"
            onClick={register}
            disabled={loading || (mode === "vendor" ? !canVendor : !canCustomer)}
          >
            {loading ? "Creating..." : "Create account"}
          </button>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 border border-red-100 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{error.message}</p>
                  {error.showSignIn && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => router.push(`/account/login${nextFromUrl ? `?next=${encodeURIComponent(nextFromUrl)}` : ""}`)}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Go to sign in
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <button
              className="text-xs font-bold text-gray-600 hover:text-orange-600 transition"
              onClick={() => router.push(`/account/login${nextFromUrl ? `?next=${encodeURIComponent(nextFromUrl)}` : ""}`)}
              disabled={loading}
            >
              Already have an account? Sign in
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
