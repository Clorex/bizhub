"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "firebase/auth";
import { toast } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";

type MeRes = {
  ok: boolean;
  me?: { email?: string | null; emailVerified?: boolean; role?: string };
  error?: string;
};

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  const clean = m.replace(/^Firebase:\s*/i, "").replace(/\(auth\/[^)]+\)\.?/gi, "").trim();
  return clean.length > 0 && clean.length < 140 ? clean : fallback;
}

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
        const m = "No email found on this account.";
        setMsg(m);
        toast.info(m);
        return;
      }

      await sendPasswordResetEmail(auth, e);
      const successMsg = "Password reset link sent to your email.";
      setMsg(successMsg);
      toast.success(successMsg);
    } catch (e: any) {
      const m = niceError(e, "Could not send reset link. Please try again.");
      setMsg(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      setBusy(true);
      setMsg(null);
      await signOut(auth);
      toast.info("Signed out successfully.");
      router.push("/account/login");
    } catch (e: any) {
      const m = niceError(e, "Could not sign out. Please try again.");
      setMsg(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Security" subtitle="Protect your account" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-biz-muted">{msg}</Card> : null}

        {!loading ? (
          <>
            <Card className="p-4">
              <p className="text-sm font-extrabold text-biz-ink">Your account</p>
              <p className="text-xs text-biz-muted mt-1">
                Email: <b className="text-biz-ink">{email || "—"}</b>
              </p>
              <p className="text-xs text-biz-muted mt-1">
                Status: <b className="text-biz-ink">{statusText}</b>
              </p>
              {role ? (
                <p className="text-xs text-biz-muted mt-1">
                  Role: <b className="text-biz-ink capitalize">{role}</b>
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={resetPassword} disabled={busy || !email}>
                  Reset password
                </Button>

                <Button variant="secondary" onClick={logout} disabled={busy}>
                  Sign out
                </Button>
              </div>

              {!emailVerified && email ? (
                <p className="mt-3 text-[11px] text-orange-700">Please verify your email to keep your account secure.</p>
              ) : null}
            </Card>

            <Card className="p-4">
              <p className="text-sm font-extrabold text-biz-ink">Team access</p>
              <p className="text-xs text-biz-muted mt-1">Only give access to people you trust.</p>

              <div className="mt-3">
                <Button variant="secondary" onClick={() => router.push("/vendor/staff")}>
                  Manage staff
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-extrabold text-biz-ink">Safety tips</p>
              <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                <li>Never share your login code (OTP) with anyone.</li>
                <li>Don't share your password with staff or friends.</li>
                <li>Only trust messages you see inside your myBizHub dashboard.</li>
                <li>If something looks suspicious, use Help to report it.</li>
              </ul>

              <div className="mt-3">
                <Button variant="secondary" onClick={() => router.push("/vendor/promote/faq")}>
                  Go to Help
                </Button>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}