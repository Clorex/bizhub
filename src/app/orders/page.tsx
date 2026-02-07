// FILE: src/app/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { getRecentOrderIds } from "@/lib/orders/recent";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";

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

function fmtDateAny(v: any) {
  const ms = toMs(v);
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

function customerStatusLabel(o: any) {
  const orderStatus = String(o?.orderStatus || "").toLowerCase();
  const ops = String(o?.opsStatusEffective || o?.opsStatus || "").toLowerCase();
  const escrow = String(o?.escrowStatus || "").toLowerCase();

  if (ops) {
    if (ops === "delivered") return "Delivered";
    if (ops === "cancelled") return "Cancelled";
    if (ops === "in_transit") return "In transit";
    if (ops === "paid") return "Paid";
  }

  if (orderStatus.includes("delivered")) return "Delivered";
  if (orderStatus.includes("cancel")) return "Cancelled";
  if (orderStatus.includes("paid")) {
    if (escrow && escrow !== "released") return "Processing";
    return "Paid";
  }

  if (escrow) {
    if (escrow === "released") return "Paid";
    if (escrow === "disputed") return "Needs attention";
    return "Processing";
  }

  return "Processing";
}

function paymentLabel(o: any) {
  const paymentType = String(o?.paymentType || "");
  if (paymentType === "direct_transfer") return "Bank transfer";
  if (paymentType === "paystack_escrow") return "Card payment";
  return "";
}

function code4DigitsFromReference(ref: string) {
  let h = 0;
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) | 0;
  const n = Math.abs(h) % 10000;
  return String(n).padStart(4, "0");
}

function StatusPill({ text }: { text: string }) {
  const t = String(text || "").toLowerCase();
  const cls =
    t.includes("attention") || t.includes("issue")
      ? "bg-red-50 text-red-700 border-red-100"
      : t.includes("processing") || t.includes("transit")
        ? "bg-orange-50 text-orange-700 border-orange-100"
        : t.includes("delivered") || t.includes("paid")
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-biz-cream text-biz-ink border-transparent";

  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold border ${cls}`}>{text}</span>;
}

export default function OrdersPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(false);
      setLoggedIn(!!u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setMsg(null);

        if (!auth.currentUser) {
          setOrders([]);
          return;
        }

        const ids = getRecentOrderIds();
        if (!ids.length) {
          setOrders([]);
          return;
        }

        const token = await auth.currentUser.getIdToken();

        const r = await fetch("/api/orders/recent", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids: ids.slice(0, 25) }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load orders");

        const list = Array.isArray(data.orders) ? data.orders : [];
        list.sort((a: any, b: any) => toMs(b.createdAt) - toMs(a.createdAt));

        if (!mounted) return;
        setOrders(list);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load orders");
        setOrders([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [loggedIn]);

  const subtitle = useMemo(() => {
    if (authLoading) return "Preparing…";
    if (!loggedIn) return "Login required to view orders";
    if (loading) return "Loading your orders…";
    if (orders.length === 0) return "No orders on this device yet";
    return `${orders.length} order(s) found`;
  }, [authLoading, loggedIn, loading, orders.length]);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Orders" subtitle={subtitle} showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loggedIn && !authLoading ? (
          <Card className="p-5 text-center">
            <p className="text-base font-extrabold text-biz-ink">Login required</p>
            <p className="text-sm text-biz-muted mt-2">Login to view and track your orders.</p>
            <div className="mt-4">
              <Link href={`/account/login?next=${encodeURIComponent("/orders")}`} className="block">
                <Button>Login</Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {loggedIn && loading ? <Card className="p-4">Loading…</Card> : null}

        {loggedIn && !loading && orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="After you checkout, your order will appear here on this device."
            ctaLabel="Go to Market"
            onCta={() => (window.location.href = "/market")}
          />
        ) : null}

        {loggedIn && !loading && orders.length > 0 ? (
          <SectionCard title="Recent orders" subtitle="Tap any order to view details">
            <div className="space-y-2">
              {orders.map((o) => {
                const amount = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
                const status = customerStatusLabel(o);
                const vendor = String(o.businessSlug || "").trim() || "—";
                const pay = paymentLabel(o);

                const ref = String(o?.payment?.reference || "").trim();
                const code = ref ? code4DigitsFromReference(ref) : "";

                return (
                  <Link key={o.id} href={`/orders/${o.id}`} className="block">
                    <div className="rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-biz-ink">Order #{String(o.id).slice(0, 8)}</p>

                          <p className="text-[11px] text-biz-muted mt-1">
                            Vendor: <b className="text-biz-ink">{vendor}</b>
                            {code ? (
                              <>
                                {" "}
                                • Code: <b className="text-biz-ink">{code}</b>
                              </>
                            ) : null}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <StatusPill text={status} />
                            {pay ? <span className="text-[11px] text-gray-500">{pay}</span> : null}
                          </div>

                          <p className="text-[11px] text-gray-500 mt-2">Created: {fmtDateAny(o.createdAt)}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(amount)}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-3">
              <Link href="/market" className="block">
                <Button variant="secondary">Continue shopping</Button>
              </Link>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}