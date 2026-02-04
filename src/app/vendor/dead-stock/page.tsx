"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { auth } from "@/lib/firebase/client";
import { RefreshCw } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
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

type AccessResp = {
  ok: boolean;
  planKey?: string;
  hasActiveSubscription?: boolean;
  features?: any;
  limits?: any;
};

export default function VendorDeadStockPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);

  const [access, setAccess] = useState<AccessResp | null>(null);

  const [meta, setMeta] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [days, setDays] = useState<number>(30);

  async function authedFetchJson(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e: any = new Error(data?.error || data?.code || "Request failed");
      e.code = data?.code || null;
      throw e;
    }
    return data;
  }

  async function loadAccess() {
    try {
      const a = (await authedFetchJson("/api/vendor/access")) as AccessResp;
      setAccess(a || null);
    } catch {
      setAccess(null);
    }
  }

  async function load(nextDays?: number) {
    try {
      setLoading(true);
      setMsg(null);
      setErrCode(null);

      const d = typeof nextDays === "number" ? nextDays : days;
      const data = await authedFetchJson(`/api/vendor/dead-stock?days=${encodeURIComponent(String(d))}`);

      setMeta(data?.meta || null);
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setDays(Number(data?.meta?.days || d));
    } catch (e: any) {
      setErrCode(String(e?.code || "").trim() || null);
      setMsg(e?.message || "Failed to load dead stock");
      setMeta(null);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await loadAccess();
      await load(30);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planKey = String(meta?.planKey || access?.planKey || "FREE").toUpperCase();
  const allowedDays: number[] = Array.isArray(meta?.allowedDays) ? meta.allowedDays : [];
  const totals = meta?.totals || null;

  const isFeatureLocked = errCode === "FEATURE_LOCKED";
  const isVendorLocked = errCode === "VENDOR_LOCKED";

  const showBuyAddon =
    isFeatureLocked && planKey === "LAUNCH"; // Launch should buy Dead Stock add-on (not forced to upgrade)

  const topBars = useMemo(() => {
    const list = (products || []).slice(0, 10);
    const max = Math.max(1, ...list.map((x) => Number(x.deadValueKobo || 0)));
    return { list, max };
  }, [products]);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Dead stock"
        subtitle="Products sitting without sales"
        showBack={true}
        right={
          <IconButton aria-label="Refresh" onClick={() => load()} disabled={loading}>
            <RefreshCw className="h-5 w-5 text-gray-700" />
          </IconButton>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {msg ? (
          <Card className="p-4 text-red-700">
            {msg}

            <div className="mt-2 flex gap-2">
              {showBuyAddon ? (
                <Button size="sm" onClick={() => router.push("/vendor/purchases")}>
                  Buy Dead Stock add-on
                </Button>
              ) : null}

              {isVendorLocked || (isFeatureLocked && !showBuyAddon) ? (
                <Button size="sm" onClick={() => router.push("/vendor/subscription")}>
                  Upgrade
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-extrabold text-biz-ink">Overview</p>
              <p className="text-xs text-biz-muted mt-1">
                Plan: <b className="text-biz-ink">{planKey}</b>
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Window: last <b>{days}</b> days
              </p>
              {totals ? (
                <p className="text-[11px] text-gray-500 mt-1">
                  Items: <b className="text-biz-ink">{Number(totals.deadCount || 0)}</b> • Value:{" "}
                  <b className="text-biz-ink">{fmtNaira(Number(totals.deadValueNgn || 0))}</b>
                </p>
              ) : null}
            </div>

            <Button variant="secondary" size="sm" onClick={() => load()} loading={loading}>
              Refresh
            </Button>
          </div>

          {allowedDays.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {allowedDays.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={days === d ? "primary" : "secondary"}
                  onClick={() => load(d)}
                  disabled={loading}
                >
                  Last {d} days
                </Button>
              ))}
            </div>
          ) : null}
        </Card>

        {!loading && products.length > 0 ? (
          <Card className="p-4">
            <p className="font-extrabold text-biz-ink">Top dead stock by value</p>
            <p className="text-[11px] text-biz-muted mt-1">No chart library — simple bars.</p>

            <div className="mt-3 space-y-2">
              {topBars.list.map((p) => {
                const v = Number(p.deadValueKobo || 0);
                const w = Math.max(4, Math.round((v / topBars.max) * 100));
                return (
                  <div key={p.productId} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-biz-ink truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-500">{fmtNaira(Number(p.deadValueNgn || 0))}</p>
                    </div>
                    <div className="h-2 w-full rounded-full bg-biz-cream overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-biz-accent2 to-biz-accent"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        {loading ? <Card className="p-4">Loading…</Card> : null}

        {!loading && products.length === 0 && !msg ? (
          <Card className="p-5 text-center">
            <p className="text-base font-extrabold text-biz-ink">No dead stock found</p>
            <p className="text-sm text-biz-muted mt-2">
              Either products are selling recently, or they are new, or stock is zero.
            </p>
          </Card>
        ) : null}

        <div className="space-y-2">
          {products.map((p) => (
            <Card key={p.productId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-biz-ink truncate">{p.name || "Product"}</p>
                  <p className="text-[11px] text-gray-500 mt-1 break-all">
                    Product ID: <b className="text-biz-ink">{p.productId}</b>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Stock: <b className="text-biz-ink">{Number(p.stock || 0)}</b> • Unit:{" "}
                    <b className="text-biz-ink">{fmtNaira(Number(p.priceNgn || 0))}</b>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Last sold: <b className="text-biz-ink">{p.lastSoldAtMs ? fmtDateMs(Number(p.lastSoldAtMs)) : "Never"}</b>
                    {p.daysSinceLastSale != null ? (
                      <>
                        {" "}
                        • <b className="text-biz-ink">{Number(p.daysSinceLastSale)}</b> day(s) ago
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(Number(p.deadValueNgn || 0))}</p>
                  <p className="text-[11px] text-gray-500 mt-1">Dead value</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}