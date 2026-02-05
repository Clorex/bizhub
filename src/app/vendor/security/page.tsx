"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

type MeRes = {
  ok: boolean;
  me?: { email?: string | null; emailVerified?: boolean; role?: string };
  error?: string;
};

export default function VendorSecurityPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [role, setRole] = useState<string>("");

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        setLoading(true);
        setMsg(null);

        if (!u) {
          setEmail(null);
          setEmailVerified(false);
          setRole("");
          setLoading(false);
          return;
        }

        setEmail(u.email || null);

        // Try to load role/emailVerified from /api/me if it exists
        try {
          const token = await u.getIdToken();
          const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
          const j = (await r.json().catch(() => ({}))) as MeRes;

          if (r.ok && j?.ok && j?.me) {
            setEmailVerified(!!j.me.emailVerified);
            setRole(String(j.me.role || ""));
          } else {
            setEmailVerified(!!u.emailVerified);
            setRole("");
          }
        } catch {
          setEmailVerified(!!u.emailVerified);
          setRole("");
        }

        setLoading(false);
      } catch {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const statusText = useMemo(() => {
    if (!email) return "Not logged in";
    return emailVerified ? "Verified" : "Not verified";
  }, [email, emailVerified]);

  async function resetPassword() {
    try {
      setBusy(true);
      setMsg(null);

      const e = auth.currentUser?.email;
      if (!e) {
        setMsg("No email found on this account.");
        return;
      }

      await sendPasswordResetEmail(auth, e);
      setMsg("Password reset link sent to your email.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to send reset link");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      setBusy(true);
      setMsg(null);
      await signOut(auth);
      router.push("/account/login");
    } catch (e: any) {
      setMsg(e?.message || "Logout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Security" subtitle="Protect your account" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4">{msg}</Card> : null}

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Account</p>
          <p className="text-xs text-biz-muted mt-1">
            Email: <b className="text-biz-ink">{email || "—"}</b>
          </p>
          <p className="text-xs text-biz-muted mt-1">
            Status: <b className="text-biz-ink">{statusText}</b>
          </p>
          {role ? (
            <p className="text-xs text-biz-muted mt-1">
              Role: <b className="text-biz-ink">{role}</b>
            </p>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetPassword}
              disabled={busy || !email}
              className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink hover:bg-black/[0.02] transition disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Reset password"}
            </button>

            <button
              type="button"
              onClick={logout}
              disabled={busy}
              className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink hover:bg-black/[0.02] transition disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Sign out"}
            </button>
          </div>

          {!emailVerified ? (
            <p className="mt-3 text-[11px] text-orange-700">Please verify your email to keep your account safe.</p>
          ) : null}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Team access</p>
          <p className="text-xs text-biz-muted mt-1">If you add staff, only give access to people you trust.</p>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => router.push("/vendor/staff")}
              className="w-full rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink hover:bg-black/[0.02] transition"
            >
              Manage staff
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Safety tips</p>
          <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>Never share your login code (OTP) with anyone.</li>
            <li>Don’t share your password with staff or friends.</li>
            <li>Only trust messages you see inside your myBizHub dashboard.</li>
            <li>If something looks suspicious, use Help & support to report it.</li>
          </ul>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => router.push("/vendor/promote/faq")}
              className="w-full rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink hover:bg-black/[0.02] transition"
            >
              Go to Help & support
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}