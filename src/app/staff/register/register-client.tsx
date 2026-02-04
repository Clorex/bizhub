"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";

type Invite = {
  code: string;
  status: "pending" | "accepted" | "revoked" | string;
  email: string;
  name?: string | null;
  jobTitle?: string | null;
  permissions?: any;
  businessSlug?: string | null;
};

function permLabel(k: string) {
  const map: Record<string, string> = {
    productsView: "View products",
    productsManage: "Manage products",
    ordersView: "View orders",
    ordersManage: "Manage orders",
    analyticsView: "View analytics",
    storeManage: "Store settings (owner-only)",
    walletAccess: "Wallet access (owner-only)",
    payoutAccess: "Payout access (owner-only)",
  };
  return map[k] || k;
}

export default function StaffRegisterClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const code = sp.get("code") || "";

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const canSubmit = useMemo(() => {
    const emailOk = (invite?.email || "").includes("@");
    return emailOk && password.length >= 6 && !creating;
  }, [invite?.email, password, creating]);

  useEffect(() => {
    let mounted = true;

    async function loadInvite() {
      setLoading(true);
      setMsg(null);
      setInvite(null);

      try {
        if (!code) throw new Error("Missing invite code.");

        const r = await fetch(`/api/staff/invite?code=${encodeURIComponent(code)}`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Failed to load invite");

        const inv = j?.invite as Invite;
        if (!inv?.email) throw new Error("Invite email missing.");

        if (!mounted) return;
        setInvite(inv);
      } catch (e: any) {
        if (!mounted) return;
        setMsg(e?.message || "Failed");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInvite();
    return () => {
      mounted = false;
    };
  }, [code]);

  async function submit() {
    setCreating(true);
    setMsg(null);

    try {
      if (!invite) throw new Error("Invite not loaded");
      if (!code) throw new Error("Missing invite code");

      if (String(invite.status || "") !== "pending") {
        throw new Error(`Invite is not pending (status: ${invite.status}). Ask the owner to resend.`);
      }

      const invitedEmail = String(invite.email || "").trim().toLowerCase();
      if (!invitedEmail.includes("@")) throw new Error("Invalid invite email");

      // Create Firebase user (this signs them in)
      await createUserWithEmailAndPassword(auth, invitedEmail, password);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing auth token");

      // Accept invite (sets role=staff, businessId, permissions, jobTitle...)
      const rAcc = await fetch("/api/staff/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const acc = await rAcc.json().catch(() => ({}));
      if (!rAcc.ok) throw new Error(acc?.error || "Failed to accept invite");

      // Send verification code (your app gates access until verified)
      await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      router.push(`/account/verify?next=${encodeURIComponent("/vendor")}`);
    } catch (e: any) {
      const errCode = String(e?.code || "");
      const errMsg = String(e?.message || "Registration failed");

      // ✅ If account already exists, route them to staff login with the same invite code
      if (errCode === "auth/email-already-in-use" || errMsg.toLowerCase().includes("email-already-in-use")) {
        router.push(`/staff/login?code=${encodeURIComponent(code)}`);
        return;
      }

      setMsg(errMsg);
    } finally {
      setCreating(false);
    }
  }

  const perms = invite?.permissions && typeof invite.permissions === "object" ? invite.permissions : {};
  const permKeys = Object.keys(perms).filter((k) => !!perms[k]);

  return (
    <Card className="p-4">
      <p className="text-base font-extrabold text-[#111827]">Create your staff account</p>
      <p className="text-sm text-gray-600 mt-1">Only set a password. Your role is pre-filled from the invite.</p>

      {loading ? <p className="mt-4 text-sm text-gray-600">Loading invite…</p> : null}

      {!loading && invite ? (
        <div className="mt-4 space-y-2">
          <input
            className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none bg-gray-50"
            value={invite.email}
            disabled
          />

          <input
            className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none bg-gray-50"
            value={invite.jobTitle ? `Role: ${invite.jobTitle}` : "Role: Staff"}
            disabled
          />

          {invite.businessSlug ? (
            <p className="text-[11px] text-gray-600">
              Business: <b>{invite.businessSlug}</b>
            </p>
          ) : null}

          <div className="rounded-2xl border border-[#E7E7EE] p-3 bg-white">
            <p className="text-sm font-bold text-[#111827]">Permissions</p>
            {permKeys.length === 0 ? (
              <p className="text-[12px] text-gray-600 mt-1">No permissions were assigned.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-[12px] text-gray-700 list-disc pl-5">
                {permKeys.map((k) => (
                  <li key={k}>{permLabel(k)}</li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-gray-500 mt-2">Owner-only items remain locked automatically.</p>
          </div>

          <input
            className="w-full border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
            placeholder="Password (min 6)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <button
            className="mt-2 w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-50"
            onClick={submit}
            disabled={!canSubmit}
          >
            {creating ? "Creating..." : "Create staff account"}
          </button>

          <button
            className="w-full rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
            onClick={() => router.push(`/staff/login?code=${encodeURIComponent(invite.code)}`)}
            disabled={creating}
          >
            Already have an account? Login
          </button>
        </div>
      ) : null}

      {msg ? <p className="mt-3 text-sm text-red-700">{msg}</p> : null}
    </Card>
  );
}