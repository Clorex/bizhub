// FILE: src/app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

export default function AdminHomePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [unread, setUnread] = useState<number>(0);

  async function authedJson(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  async function loadMe() {
    try {
      const data = await authedJson("/api/me");
      setMe(data.me);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    }
  }

  async function loadUnread() {
    try {
      const data = await authedJson("/api/admin/notifications?mode=count");
      setUnread(Number(data?.unreadCount || 0));
    } catch {
      setUnread(0);
    }
  }

  useEffect(() => {
    loadMe();
    loadUnread();

    const t = setInterval(loadUnread, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badgeText = unread > 99 ? "99+" : String(unread);

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader
        title="Admin"
        showBack={true}
        subtitle="Control center"
        right={
          <button
            type="button"
            onClick={() => router.push("/admin/notifications")}
            className="relative flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="h-5 w-5 text-gray-700" />
            {unread > 0 ? (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {badgeText}
              </span>
            ) : null}
          </button>
        }
      />

      <div className="px-4 pb-32 space-y-4">
        <div className="rounded-3xl p-5 text-white shadow-sm bg-gradient-to-br from-orange-500 to-orange-600">
          <p className="text-sm font-bold">Admin Panel</p>
          <p className="text-xs opacity-90 mt-1">Role: {me?.role || "—"}</p>
        </div>

        {msg ? (
          <Card className="p-4">
            <p className="text-sm text-red-700">{msg}</p>
          </Card>
        ) : null}

        <Card className="p-4">
          <p className="font-bold text-gray-900">Tools</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
              onClick={() => router.push("/admin/analytics")}
            >
              Analytics
            </button>

            <button
              className="rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
              onClick={() => router.push("/admin/finance")}
            >
              myBizHub Balance
            </button>

            <button
              className="rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
              onClick={() => router.push("/admin/vendors")}
            >
              Vendors
            </button>

            <button
              className="rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
              onClick={() => router.push("/admin/customers")}
            >
              Customers
            </button>

            <button
              className="rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
              onClick={() => router.push("/admin/withdrawals")}
            >
              Withdrawals
            </button>

            <button
              className="rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
              onClick={() => router.push("/admin/disputes")}
            >
              Disputes
            </button>

            <button
              className="rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
              onClick={() => router.push("/admin/verification")}
            >
              Verification
            </button>

            <button
              className="rounded-2xl border border-gray-100 bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
              onClick={() => router.push("/admin/packages")}
            >
              Packages
            </button>

            {/* ✅ ADDED: Smart Match button */}
            <button
              className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white py-3 text-sm font-bold text-orange-700 hover:from-orange-100 transition col-span-2"
              onClick={() => router.push("/admin/smartmatch")}
            >
              ⚡ Smart Match Controls
            </button>
          </div>

          <p className="mt-3 text-[11px] text-gray-500">
            Packages controls all limits and feature locks without code changes.
          </p>
        </Card>
      </div>
    </div>
  );
}