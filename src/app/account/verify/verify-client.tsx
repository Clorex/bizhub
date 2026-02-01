"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";

export default function VerifyClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/account";

  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  async function sendCode() {
    setLoading(true);
    setMsg(null);
    setDevCode(null);
    try {
      const data = await authedFetch("/api/auth/send-email-code", { method: "POST" });
      if (data?.devCode) setDevCode(String(data.devCode));
      setMsg("Verification code sent. Check your email.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    setMsg(null);
    try {
      await authedFetch("/api/auth/verify-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      await auth.currentUser?.reload();
      router.push(next);
    } catch (e: any) {
      setMsg(e?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.currentUser) sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="p-4">
      <p className="font-extrabold text-[#111827]">Verification code</p>
      <p className="text-sm text-gray-600 mt-1">We sent a 4-digit code to your email.</p>

      <input
        className="mt-4 w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm tracking-widest text-center outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
        placeholder="1234"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        maxLength={4}
      />

      <button
        className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-50"
        onClick={verify}
        disabled={loading || code.trim().length !== 4}
      >
        Verify
      </button>

      <button
        className="mt-3 w-full rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
        onClick={sendCode}
        disabled={loading}
      >
        Resend code
      </button>

      {devCode ? (
        <p className="mt-3 text-xs text-gray-600">
          DEV ONLY code: <b>{devCode}</b>
        </p>
      ) : null}

      {msg ? <p className="mt-3 text-sm text-gray-700">{msg}</p> : null}
    </Card>
  );
}