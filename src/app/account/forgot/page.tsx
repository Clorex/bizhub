"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  // Remove Firebase error prefixes
  const clean = m.replace(/^Firebase:\s*/i, "").replace(/\(auth\/[^)]+\)\.?/gi, "").trim();
  return clean.length > 0 && clean.length < 140 ? clean : fallback;
}

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
      const successMsg = "Password reset link sent. Check your email inbox (and spam folder).";
      setMsg(successMsg);
      toast.success(successMsg);
    } catch (e: any) {
      const m = niceError(e, "Could not send reset link. Please check your email and try again.");
      setMsg(m);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Reset Password" subtitle="Get a link to reset your password" showBack={true} />

      <div className="px-4 pb-24">
        <Card className="p-4">
          <p className="text-base font-extrabold text-biz-ink">Reset your password</p>
          <p className="text-sm text-biz-muted mt-1">
            Enter your email address and we'll send you a link to create a new password.
          </p>

          <div className="mt-4 space-y-2">
            <Input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="mt-4 space-y-2">
            <Button onClick={sendLink} disabled={!email.trim() || loading} loading={loading}>
              Send reset link
            </Button>

            <Button variant="secondary" onClick={() => router.push("/account/login")} disabled={loading}>
              Back to login
            </Button>
          </div>

          {msg ? (
            <p className={ok ? "mt-3 text-sm text-emerald-700" : "mt-3 text-sm text-red-700"}>
              {msg}
            </p>
          ) : null}

          {ok ? (
            <p className="mt-2 text-[11px] text-biz-muted">
              Didn't receive the email? Check your spam folder or try again with a different email.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}