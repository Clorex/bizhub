"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";

export default function StaffInviteAcceptPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const code = sp.get("code") || "";

  const [status, setStatus] = useState<"loading" | "ready" | "ok" | "error">("loading");
  const [msg, setMsg] = useState<string>("Preparing…");

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        if (!code) {
          setStatus("error");
          setMsg("Missing invite code.");
          return;
        }

        // Must be logged in
        const user = auth.currentUser;
        if (!user) {
          router.replace(`/account/login?next=${encodeURIComponent(`/account/invite?code=${code}`)}`);
          return;
        }

        // Confirm verified email
        await user.reload();
        if (!user.emailVerified) {
          router.replace(`/account/verify?next=${encodeURIComponent(`/account/invite?code=${code}`)}`);
          return;
        }

        const token = await user.getIdToken();

        setStatus("ready");
        setMsg("Accept this staff invite to join the business.");
        if (!mounted) return;
      } catch (e: any) {
        if (!mounted) return;
        setStatus("error");
        setMsg(e?.message || "Failed");
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [code, router]);

  async function accept() {
    try {
      setStatus("loading");
      setMsg("Accepting invite…");

      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/staff/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to accept invite");

      setStatus("ok");
      setMsg("Invite accepted. You now have staff access.");
    } catch (e: any) {
      setStatus("error");
      setMsg(e?.message || "Failed");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Staff Invite" subtitle="Join a business as staff" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        <Card className="p-5 text-center">
          <p className="text-base font-bold text-biz-ink">
            {status === "loading" ? "Processing…" : status === "ok" ? "Success" : status === "error" ? "Issue" : "Invite"}
          </p>

          <p className={status === "error" ? "text-sm text-red-700 mt-2" : "text-sm text-biz-muted mt-2"}>
            {msg}
          </p>

          <p className="text-[11px] text-gray-500 mt-3 break-all">Code: {code || "—"}</p>

          <div className="mt-4 space-y-2">
            {status === "ready" ? (
              <Button onClick={accept}>Accept invite</Button>
            ) : null}

            {status === "ok" ? (
              <Button onClick={() => router.push("/vendor")}>Go to Vendor</Button>
            ) : null}

            <Button variant="secondary" onClick={() => router.push("/account")}>
              Account
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}