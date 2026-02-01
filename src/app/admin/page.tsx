// FILE: src/app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { useRouter } from "next/navigation";

export default function AdminHomePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load");
        setMe(data.me);
      } catch (e: any) {
        setMsg(e?.message || "Failed");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Admin" showBack={true} subtitle="Control center" />

      <div className="px-4 pb-24 space-y-3">
        <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
          <p className="text-sm font-bold">Admin Panel</p>
          <p className="text-xs opacity-95 mt-1">Role: {me?.role || "—"}</p>
        </div>

        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        <Card className="p-4">
          <p className="font-bold text-biz-ink">Tools</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold" onClick={() => router.push("/admin/analytics")}>
              Analytics
            </button>

            <button className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold" onClick={() => router.push("/admin/finance")}>
              BizHub Balance
            </button>

            <button className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold" onClick={() => router.push("/admin/vendors")}>
              Vendors
            </button>

            <button className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold" onClick={() => router.push("/admin/customers")}>
              Customers
            </button>

            <button className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold" onClick={() => router.push("/admin/withdrawals")}>
              Withdrawals
            </button>

            <button className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold" onClick={() => router.push("/admin/disputes")}>
              Disputes
            </button>

            <button className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold" onClick={() => router.push("/admin/verification")}>
              Verification
            </button>

            <button className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold" onClick={() => router.push("/admin/packages")}>
              Packages
            </button>
          </div>

          <p className="mt-3 text-[11px] text-biz-muted">
            Packages controls all limits and feature locks without code changes.
          </p>
        </Card>
      </div>
    </div>
  );
}