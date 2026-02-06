"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { RefreshCw, Download, Link2, PackagePlus } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch {
    return 0;
  }
}

function fmtDate(v: any) {
  try {
    if (!v) return "—";
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
    return String(v);
  } catch {
    return "—";
  }
}

function labelOps(s: string) {
  if (s === "new") return "New";
  if (s === "contacted") return "Contacted";
  if (s === "paid") return "Paid";
  if (s === "in_transit") return "In transit";
  if (s === "delivered") return "Delivered";
  if (s === "cancelled") return "Cancelled";
  return s || "—";
}

function StatusPill({ text }: { text: string }) {
  const t = text.toLowerCase();

  const cls =
    t.includes("cancel")
      ? "bg-gray-100 text-gray-700 border-gray-200"
      : t.includes("deliver")
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : t.includes("transit")
          ? "bg-blue-50 text-blue-700 border-blue-100"
          : t.includes("paid")
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : t.includes("contact")
              ? "bg-orange-50 text-orange-700 border-orange-100"
              : t.includes("dispute") || t.includes("disputed")
                ? "bg-red-50 text-red-700 border-red-100"
                : "bg-biz-cream text-biz-ink border-transparent";

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold border ${cls}`}>
      {text}
    </span>
  );
}

export default function VendorOrdersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);

  const [me, setMe] = useState<any>(null);

  const storeUrl = useMemo(() => {
    const slug = String(me?.businessSlug || "").trim();
    if (!slug) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/b/${slug}`;
  }, [me]);

  async function load() {
    try {
      setLoading(true);
      setMsg(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await rMe.json().catch(() => ({}));
      if (rMe.ok) setMe(meData?.me || null);

      const r = await fetch("/api/vendor/orders", { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed");

      const list = Array.isArray(data.orders) ? data.orders : [];
      list.sort((a: any, b: any) => toMs(b.createdAt) - toMs(a.createdAt));
      setOrders(list);
      setMeta(data?.meta || null);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load orders");
      setOrders([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    try {
      setExporting(true);
      setMsg(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const r = await fetch("/api/vendor/orders/export", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        const err = String(data?.error || "Export failed");
        const code = String(data?.code || "");
        if (code === "FEATURE_LOCKED") {
          setMsg(err);
          return;
        }
        throw new Error(err);
      }

      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/i);
      const filename = m?.[1] || `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setMsg(e?.message || "Failed to export");
    } finally {
      setExporting(false);
    }
  }

  async function copyStoreLink() {
    try {
      if (!storeUrl) {
        setMsg("Store link not ready yet. Please refresh.");
        return;
      }
      await navigator.clipboard.writeText(storeUrl);
      setMsg("Store link copied.");
      setTimeout(() => setMsg(null), 1200);
    } catch {
      setMsg("Copy failed.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const count = orders.length;
    const disputed = orders.filter((o) => String(o?.escrowStatus || "").toLowerCase() === "disputed").length;
    const awaiting = orders.filter((o) => String(o?.orderStatus || "").includes("awaiting")).length;
    return { count, disputed, awaiting };
  }, [orders]);

  const planKey = String(meta?.planKey || "FREE");
  const cap = Number(meta?.limits?.ordersVisible || orders.length || 0);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Orders"
        subtitle="All orders for your store"
        showBack={false}
        right={
          <IconButton aria-label="Refresh" onClick={load} disabled={loading}>
            <RefreshCw className="h-5 w-5 text-gray-700" />
          </IconButton>
        }
      />

      <div className="px-4 pb-6 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-extrabold text-biz-ink">Overview</p>
              <p className="text-xs text-gray-500 mt-1">
                {totals.count} order(s) • {totals.awaiting} awaiting • {totals.disputed} disputed
              </p>
              {meta ? (
                <p className="text-[11px] text-gray-500 mt-1">
                  Plan: <b className="text-biz-ink">{planKey}</b> • Showing up to <b className="text-biz-ink">{cap}</b>
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={exportCsv}
                loading={exporting}
                disabled={loading || exporting}
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export
              </Button>

              <Button variant="secondary" size="sm" onClick={load} loading={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {loading ? <Card className="p-4">Loading…</Card> : null}

        {/* ✅ Minimal empty state */}
        {!loading && orders.length === 0 ? (
          <Card variant="soft" className="p-5">
            <p className="text-sm font-extrabold text-biz-ink">No orders yet</p>
            <p className="text-xs text-gray-500 mt-1">Your first order will show here.</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={copyStoreLink} disabled={!storeUrl} leftIcon={<Link2 className="h-4 w-4" />}>
                Copy link
              </Button>
              <Button variant="secondary" onClick={() => router.push("/vendor/products/new")} leftIcon={<PackagePlus className="h-4 w-4" />}>
                Add product
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="space-y-3">
          {orders.map((o) => {
            const ops = String(o.opsStatusEffective || o.opsStatus || "");
            const statusText = ops ? labelOps(ops) : String(o.orderStatus || o.escrowStatus || "—");
            const amount = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);

            return (
              <button key={o.id} className="w-full text-left" onClick={() => router.push(`/vendor/orders/${o.id}`)}>
                <Card className="p-4 hover:bg-black/[0.02] transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-biz-ink">Order #{String(o.id).slice(0, 8)}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusPill text={statusText} />
                        <span className="text-[11px] text-gray-500">{o.paymentType || "—"}</span>
                      </div>

                      <p className="text-[11px] text-gray-500 mt-2">Created: {fmtDate(o.createdAt)}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-biz-ink">{fmtNaira(amount)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Items: {Array.isArray(o.items) ? o.items.length : 0}</p>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}