"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";

type Status = "loading" | "ready" | "ok" | "error";

export default function InviteAcceptClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const code = sp.get("code") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState<string>("Preparing...");
  const [errCode, setErrCode] = useState<string>("");

  const ownerMessage = useMemo(() => {
    if (!errCode) return "";
    if (errCode === "FEATURE_LOCKED") {
      return "Hi, I tried to accept the staff invite but your current plan does not allow adding staff. Please upgrade your myBizHub plan to add staff members.";
    }
    if (errCode === "STAFF_LIMIT_REACHED") {
      return "Hi, I tried to accept the staff invite but your staff limit has been reached. Please upgrade your myBizHub plan or remove an old staff member, then resend the invite.";
    }
    return "Hi, I tried to accept the staff invite but it failed. Please check the invite and resend.";
  }, [errCode]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        if (!code) {
          setStatus("error");
          setMsg("Missing invite code.");
          return;
        }

        const user = auth.currentUser;
        if (!user) {
          // ✅ New staff flow: let them register first
          router.replace(`/staff/register?code=${encodeURIComponent(code)}`);
          return;
        }

        await user.reload();
        if (!user.emailVerified) {
          router.replace(`/account/verify?next=${encodeURIComponent(`/account/invite?code=${code}`)}`);
          return;
        }

        if (!mounted) return;
        setStatus("ready");
        setMsg("Accept this staff invite to join the business.");
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
      setErrCode("");
      setStatus("loading");
      setMsg("Accepting invite...");

      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/staff/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const c = String(data?.code || "");
        setErrCode(c);
        throw new Error(String(data?.error || "Failed to accept invite"));
      }

      setStatus("ok");
      setMsg("Invite accepted. You now have staff access.");
    } catch (e: any) {
      setStatus("error");
      setMsg(e?.message || "Failed");
    }
  }

  async function copyOwnerMessage() {
    try {
      if (!ownerMessage) return;
      await navigator.clipboard.writeText(ownerMessage);
      alert("Message copied. Send it to the business owner.");
    } catch {
      alert(ownerMessage);
    }
  }

  return (
    <Card className="p-5 text-center">
      <p className="text-base font-bold text-biz-ink">
        {status === "loading" ? "Processing..." : status === "ok" ? "Success" : status === "error" ? "Issue" : "Invite"}
      </p>

      <p className={status === "error" ? "text-sm text-red-700 mt-2" : "text-sm text-biz-muted mt-2"}>{msg}</p>

      <p className="text-[11px] text-gray-500 mt-3 break-all">Code: {code || "—"}</p>

      <div className="mt-4 space-y-2">
        {status === "ready" ? <Button onClick={accept}>Accept invite</Button> : null}

        {status === "error" && (errCode === "FEATURE_LOCKED" || errCode === "STAFF_LIMIT_REACHED") ? (
          <Button variant="secondary" onClick={copyOwnerMessage}>
            Copy message to owner
          </Button>
        ) : null}

        {status === "ok" ? <Button onClick={() => router.push("/vendor")}>Go to Vendor</Button> : null}

        <Button variant="secondary" onClick={() => router.push("/account")}>
          Account
        </Button>
      </div>
    </Card>
  );
}