"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next"); // if present, we go there after login

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setMsg(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);

      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to load profile");

      const role = data?.me?.role;
      const emailVerified = !!data?.me?.emailVerified;

      // if not verified, verify first then continue to next
      const fallbackNext = role === "admin" ? "/admin" : role === "owner" ? "/vendor" : "/market";
      const dest = next || fallbackNext;

      if (!emailVerified) {
        router.push(`/account/verify?next=${encodeURIComponent(dest)}`);
        return;
      }

      router.push(dest);
    } catch (e: any) {
      setMsg(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Login" showBack={true} />

      <div className="px-4 pb-24">
        <Card className="p-4">
          <p className="text-base font-extrabold text-[#111827]">Welcome back</p>
          <p className="text-sm text-gray-600 mt-1">Login to continue.</p>

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
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-50"
            onClick={login}
            disabled={!email || !password || loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <div className="mt-3 flex items-center justify-between">
            <button
              className="text-xs font-extrabold text-[#FF8A00]"
              onClick={() => router.push("/account/forgot")}
              disabled={loading}
            >
              Forgot password?
            </button>

            <button
              className="text-xs font-extrabold text-[#111827]"
              onClick={() => router.push(`/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`)}
              disabled={loading}
            >
              Create account
            </button>
          </div>

          {msg ? <p className="mt-3 text-sm text-red-700">{msg}</p> : null}
        </Card>
      </div>
    </div>
  );
}