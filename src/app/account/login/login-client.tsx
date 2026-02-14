"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getFriendlyAuthError } from "@/lib/auth/friendlyError";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function LoginClient({ storeName }: { storeName?: string | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; showSignUp?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);

      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to load profile");

      const role = data?.me?.role;
      const emailVerified = !!data?.me?.emailVerified;

      const fallbackNext =
        role === "admin" ? "/admin" :
        role === "owner" ? "/vendor" :
        role === "staff" ? "/vendor" : "/market";

      const dest = next || fallbackNext;

      if (!emailVerified) {
        router.push(`/account/verify?next=${encodeURIComponent(dest)}`);
        return;
      }

      router.push(dest);
    } catch (e: any) {
      const friendly = getFriendlyAuthError(e);
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4">
      <p className="text-base font-extrabold text-gray-900">
        {storeName ? `Login to ${storeName}` : "Welcome back"}
      </p>
      <p className="text-sm text-gray-500 mt-1">
        {storeName ? "Continue to complete your action." : "Login to continue."}
      </p>

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
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <button
        className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 disabled:opacity-50 transition"
        onClick={login}
        disabled={!email || !password || loading}
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      {error && (
        <div className="mt-4 rounded-2xl bg-red-50 border border-red-100 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{error.message}</p>
              {error.showSignUp && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => router.push(`/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create account
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          className="text-xs font-bold text-orange-600 hover:text-orange-700 transition"
          onClick={() => router.push("/account/forgot")}
          disabled={loading}
        >
          Forgot password?
        </button>
        <button
          className="text-xs font-bold text-gray-600 hover:text-gray-800 transition"
          onClick={() => router.push(`/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`)}
          disabled={loading}
        >
          Create account
        </button>
      </div>
    </Card>
  );
}
