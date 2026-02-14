"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "firebase/auth";
import { toast } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  const clean = m.replace(/^Firebase:\s*/i, "").replace(/\(auth\/[^)]+\)\.?/gi, "").trim();
  return clean.length > 0 && clean.length < 140 ? clean : fallback;
}

export default function CustomerSecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/account/login?redirect=/account/security");
        return;
      }
      setEmail(u.email || null);
      setEmailVerified(!!u.emailVerified);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

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

  if (loading) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Security" subtitle="Protect your account" showBack />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Security" subtitle="Protect your account" showBack />
      <div className="px-4 pb-28 space-y-3">
        {msg && <Card className="p-4 text-biz-muted">{msg}</Card>}

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Your account</p>
          <p className="text-xs text-biz-muted mt-1">
            Email: <b className="text-biz-ink">{email || "\u2014"}</b>
          </p>
          <p className="text-xs text-biz-muted mt-1">
            Status: <b className="text-biz-ink">{statusText}</b>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={resetPassword} disabled={busy || !email}>
              Reset password
            </Button>
            <Button variant="secondary" onClick={logout} disabled={busy}>
              Sign out
            </Button>
          </div>
          {!emailVerified && email && (
            <p className="mt-3 text-[11px] text-orange-700">
              Please verify your email to keep your account secure.
            </p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Safety tips</p>
          <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>Never share your login code (OTP) with anyone.</li>
            <li>Don't share your password with others.</li>
            <li>Only trust messages inside myBizHub.</li>
            <li>If something looks suspicious, contact support.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
