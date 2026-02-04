"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import { RefreshCw } from "lucide-react";

function fmtNairaFromKobo(kobo: number) {
  const n = Number(kobo || 0) / 100;
  try {
    return `₦${n.toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function fmtDateMs(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function Pill({ read }: { read: boolean }) {
  return (
    <span
      className={
        read
          ? "px-2 py-1 rounded-full text-[11px] font-bold bg-gray-50 text-gray-700 border border-gray-100"
          : "px-2 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100"
      }
    >
      {read ? "Read" : "New"}
    </span>
  );
}

export default function AdminNotificationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Request failed");
    return j;
  }

  async function load() {
    try {
      setLoading(true);
      setMsg(null);
      const data = await api("/api/admin/notifications");
      setRows(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (e: any) {
      setMsg(e?.message || "Failed to load notifications");
      setRows([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      setMsg(null);
      await api("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    }
  }

  async function markRead(id: string) {
    try {
      await api("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id }),
      });
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const upgrades = useMemo(() => rows.filter((r) => String(r.type || "").includes("subscription")), [rows]);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Notifications"
        subtitle="Upgrades and important events"
        showBack={true}
        right={
          <Button variant="secondary" size="sm" onClick={load} leftIcon={<RefreshCw className="h-4 w-4" />} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        <Card className="p-4">
          <p className="font-extrabold text-biz-ink">Overview</p>
          <p className="text-xs text-biz-muted mt-1">
            Unread: <b className="text-biz-ink">{unreadCount}</b> • Total: <b className="text-biz-ink">{rows.length}</b>
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={markAllRead} disabled={loading || unreadCount <= 0}>
              Mark all read
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push("/admin/finance")}>
              View finance
            </Button>
          </div>
        </Card>

        {loading ? <Card className="p-4">Loading…</Card> : null}

        {!loading && rows.length === 0 ? (
          <Card className="p-5 text-center">
            <p className="text-base font-extrabold text-biz-ink">No notifications yet</p>
            <p className="text-sm text-biz-muted mt-2">Upgrades will appear here.</p>
          </Card>
        ) : null}

        <div className="space-y-2">
          {(upgrades.length ? upgrades : rows).map((n) => {
            const read = !!n.read;
            const planKey = String(n.planKey || "");
            const cycle = String(n.cycle || "");
            const amt = Number(n.amountKobo || 0);
            const bid = String(n.businessId || "");
            const slug = String(n.businessSlug || "");
            const ref = String(n.reference || "");
            const when = Number(n.createdAtMs || 0);

            return (
              <Card key={n.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill read={read} />
                      <p className="text-sm font-extrabold text-biz-ink">
                        {String(n.type || "notification").replaceAll("_", " ")}
                      </p>
                    </div>

                    <p className="text-[11px] text-gray-500 mt-2">
                      Time: <b className="text-biz-ink">{fmtDateMs(when)}</b>
                    </p>

                    {bid ? (
                      <p className="text-[11px] text-gray-500 mt-1 break-all">
                        Business: <b className="text-biz-ink">{bid}</b>
                        {slug ? <> • <b className="text-biz-ink">{slug}</b></> : null}
                      </p>
                    ) : null}

                    {planKey ? (
                      <p className="text-[11px] text-gray-500 mt-1">
                        Plan: <b className="text-biz-ink">{planKey}</b>
                        {cycle ? <> • <b className="text-biz-ink">{cycle}</b></> : null}
                      </p>
                    ) : null}

                    {amt ? (
                      <p className="text-[11px] text-gray-500 mt-1">
                        Amount: <b className="text-biz-ink">{fmtNairaFromKobo(amt)}</b>
                      </p>
                    ) : null}

                    {ref ? (
                      <p className="text-[11px] text-gray-500 mt-1 break-all">
                        Ref: <b className="text-biz-ink">{ref}</b>
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {!read ? (
                        <Button size="sm" variant="secondary" onClick={() => markRead(String(n.id))}>
                          Mark read
                        </Button>
                      ) : null}

                      {bid ? (
                        <Button size="sm" onClick={() => router.push(`/admin/vendors/${encodeURIComponent(bid)}`)}>
                          View vendor
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}