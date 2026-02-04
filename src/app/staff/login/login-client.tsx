"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";

type Invite = {
  code: string;
  status: string;
  email: string;
};

export default function StaffLoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const code = sp.get("code") || "";

  const [invite, setInvite] = useState<Invite | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadInvite() {
      if (!code) return;

      try {
        const r = await fetch(`/api/staff/invite?code=${encodeURIComponent(code)}`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return;

        const inv = j?.invite as Invite;
        if (!mounted) return;

        setInvite(inv);
        if (inv?.email) setEmail(String(inv.email));
      } catch {
        // ignore
      }
    }

    loadInvite();
    return () => {
      mounted = false;
    };
  }, [code]);

  async function login() {
    setLoading(true);
    setMsg(null);

    try {
      const e = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, e, password);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing auth token");

      // If they came from an invite, accept it immediately after login
      if (code) {
        const rAcc = await fetch("/api/staff/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code }),
        });

        const acc = await rAcc.json().catch(() => ({}));
        if (!rAcc.ok) {
          // Common cases: already accepted/revoked/not pending => warn but continue to login flow
          console.warn("Accept invite failed:", acc);
        }
      }

      // Load profile to know role + email verification status
      const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await rMe.json().catch(() => ({}));
      if (!rMe.ok) throw new Error(meData?.error || "Failed to load profile");

      const role = String(meData?.me?.role || "");
      const emailVerified = !!meData?.me?.emailVerified;

      if (!emailVerified) {
        router.push(`/account/verify?next=${encodeURIComponent("/vendor")}`);
        return;
      }

      const dest =
        role === "admin" ? "/admin" :
        role === "owner" ? "/vendor" :
        role === "staff" ? "/vendor" :
        "/market";

      router.push(dest);
    } catch (e: any) {
      setMsg(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const emailLocked = !!(invite?.email && code);

  return (
    <Card className="p-4">
      <p className="text-base font-extrabold text-[#111827]">Welcome back</p>
      <p className="text-sm text-gray-600 mt-1">Login with your invited email.</p>

      <div className="mt-4 space-y-2">
        <input
          className={[
            "w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35",
            emailLocked ? "bg-gray-50" : "",
          ].join(" ")}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={emailLocked || loading}
        />

        <input
          className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
        />
      </div>

      <button
        className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-50"
        onClick={login}
        disabled={!email || !password || loading}
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      <button
        className="mt-3 w-full rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
        onClick={() => router.push(`/staff/register${code ? `?code=${encodeURIComponent(code)}` : ""}`)}
        disabled={loading}
      >
        Create staff account
      </button>

      {msg ? <p className="mt-3 text-sm text-red-700">{msg}</p> : null}
    </Card>
  );
}