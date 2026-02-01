// FILE: src/components/admin/AdminSecurityGate.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type SessionRes = { ok: boolean; verified?: boolean; verifiedUntilMs?: number; error?: string };

export function AdminSecurityGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [devCode, setDevCode] = useState<string | null>(null);
  const [autoSent, setAutoSent] = useState(false);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not logged in");

    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });

    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json: j };
  }

  async function checkSession() {
    setLoading(true);
    setMsg(null);
    setDevCode(null);
    try {
      const res = await authedFetch("/api/admin/security/session");
      const data = res.json as SessionRes;

      if (!res.ok || !data.ok) {
        setVerified(false);
        setLoading(false);
        setMsg(data?.error || "Admin security check failed");
        return;
      }

      const isOk = !!data.verified;
      setVerified(isOk);
      setLoading(false);

      // Auto-send code once per page load if not verified (matches your “strict” requirement)
      if (!isOk && !autoSent) {
        setAutoSent(true);
        setTimeout(sendCode, 0);
      }
    } catch (e: any) {
      setVerified(false);
      setLoading(false);
      setMsg(e?.message || "Admin security check failed");
    }
  }

  async function sendCode() {
    setSending(true);
    setMsg(null);
    setDevCode(null);
    try {
      const res = await authedFetch("/api/admin/security/send-code", { method: "POST" });
      const data = res.json as any;
      if (!res.ok || !data.ok) throw new Error(data?.error || "Failed to send code");

      if (data?.devCode) setDevCode(String(data.devCode));
      setMsg("Verification code sent to your email.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to send code");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    setVerifying(true);
    setMsg(null);
    try {
      const res = await authedFetch("/api/admin/security/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = res.json as any;
      if (!res.ok || !data.ok) throw new Error(data?.error || "Verification failed");

      setVerified(true);
      setMsg("Verified.");
    } catch (e: any) {
      setMsg(e?.message || "Verification failed");
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-biz-bg">
        <Card className="p-4">Loading…</Card>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="min-h-screen p-4 bg-biz-bg">
        <Card className="p-4">
          <p className="text-base font-bold text-biz-ink">Admin verification</p>
          <p className="text-xs text-biz-muted mt-1">
            For security, a code is required before you can use admin pages.
          </p>

          {msg ? <p className="mt-3 text-sm text-gray-700">{msg}</p> : null}

          <div className="mt-4 space-y-2">
            <Input
              placeholder="Enter email code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={sendCode} loading={sending} disabled={sending}>
                Resend code
              </Button>
              <Button onClick={verifyCode} loading={verifying} disabled={verifying || code.trim().length < 4}>
                Verify
              </Button>
            </div>

            {devCode ? (
              <p className="text-[11px] text-gray-500">
                DEV ONLY code: <b className="text-biz-ink">{devCode}</b>
              </p>
            ) : null}

            <Button variant="secondary" onClick={checkSession}>
              Refresh
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}