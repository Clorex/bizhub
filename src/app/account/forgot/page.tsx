"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendLink() {
    setLoading(true);
    setMsg(null);
    setOk(false);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setOk(true);
      setMsg("Password reset link sent. Check your email inbox (and spam).");
    } catch (e: any) {
      setMsg(e?.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Forgot Password" showBack={true} />

      <div className="px-4 pb-24">
        <Card className="p-4">
          <p className="text-base font-extrabold text-[#111827]">Reset your password</p>
          <p className="text-sm text-gray-600 mt-1">
            Enter your email and we will send a reset link.
          </p>

          <div className="mt-4 space-y-2">
            <input
              className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <button
            className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-50"
            onClick={sendLink}
            disabled={!email || loading}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>

          <button
            className="mt-3 w-full rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
            onClick={() => router.push("/account/login")}
            disabled={loading}
          >
            Back to login
          </button>

          {msg ? (
            <p className={ok ? "mt-3 text-sm text-green-700" : "mt-3 text-sm text-red-700"}>
              {msg}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}