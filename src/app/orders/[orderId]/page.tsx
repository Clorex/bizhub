// FILE: src/app/orders/[orderId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
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

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = String((params as any)?.orderId ?? "");

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [o, setO] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const items = useMemo(() => (Array.isArray(o?.items) ? o.items : []), [o]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(false);
      if (!u) {
        setLoggedIn(false);
        router.replace(`/account/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
        return;
      }
      setLoggedIn(true);
    });
    return () => unsub();
  }, [router, orderId]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setMsg(null);

        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Not logged in");

        const r = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load order");

        if (!mounted) return;
        setO(data.order || null);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load order");
        setO(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (orderId && loggedIn) run();
    return () => {
      mounted = false;
    };
  }, [orderId, loggedIn]);

  const canDispute =
    o?.paymentType === "paystack_escrow" &&
    o?.escrowStatus !== "released" &&
    o?.escrowStatus !== "disputed";

  const amount = Number(o?.amount || (o?.amountKobo ? o.amountKobo / 100 : 0) || 0);

  const ops = String(o?.opsStatusEffective || o?.opsStatus || "").trim();
  const progressLabel = ops ? labelOps(ops) : null;

  if (authLoading || !loggedIn) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Order details" showBack={true} subtitle="Preparing…" />
        <div className="px-4 pb-24">
          <Card className="p-4">Loading…</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Order details" showBack={true} subtitle={orderId ? `#${orderId.slice(0, 8)}` : undefined} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && o ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-sm font-extrabold">Order summary</p>
              <p className="text-2xl font-extrabold mt-2">{fmtNaira(amount)}</p>

              <p className="text-xs opacity-95 mt-1">
                Status: <b>{o.orderStatus || o.escrowStatus || "—"}</b>
              </p>

              {progressLabel ? (
                <p className="text-[11px] opacity-95 mt-2">
                  Progress: <b>{progressLabel}</b>
                </p>
              ) : null}

              <p className="text-[11px] opacity-90 mt-2">Created: {fmtDate(o.createdAt)}</p>
            </div>

            <SectionCard title="Store" subtitle="Order source">
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  Slug: <b className="text-biz-ink">{o.businessSlug || "—"}</b>
                </div>
                <div>
                  Payment: <b className="text-biz-ink">{o.paymentType || "—"}</b>
                </div>
                {o?.payment?.reference ? (
                  <div className="text-[11px] text-gray-500 break-all">
                    Reference: <b className="text-biz-ink">{o.payment.reference}</b>
                  </div>
                ) : null}
              </div>

              {o.businessSlug ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => router.push(`/b/${o.businessSlug}`)}>
                    Visit store
                  </Button>
                  <Button onClick={() => router.push("/market")}>Market</Button>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="Items" subtitle={`${items.length} item(s)`}>
              <div className="space-y-2">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="rounded-2xl border border-biz-line bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-extrabold text-biz-ink truncate">{it?.name || "Item"}</p>

                        {it?.selectedOptions && Object.keys(it.selectedOptions).length ? (
                          <p className="text-[11px] text-gray-500 mt-1">
                            {Object.entries(it.selectedOptions)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" • ")}
                          </p>
                        ) : null}

                        <p className="text-[11px] text-gray-500 mt-1">
                          Qty: <b className="text-biz-ink">{it?.qty ?? 1}</b>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(it?.price || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Customer" subtitle="Delivery information">
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  Name: <b className="text-biz-ink">{o?.customer?.fullName || "—"}</b>
                </div>
                <div>
                  Phone: <b className="text-biz-ink">{o?.customer?.phone || "—"}</b>
                </div>
                {o?.customer?.address ? (
                  <div>
                    Address: <b className="text-biz-ink">{o.customer.address}</b>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {canDispute ? (
              <Card className="p-4">
                <Button onClick={() => router.push(`/orders/${orderId}/dispute`)}>Raise a dispute</Button>
                <p className="mt-2 text-[11px] text-biz-muted">Only use disputes for real issues (wrong item, not delivered, etc).</p>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}