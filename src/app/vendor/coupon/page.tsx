"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

type CouponType = "percent" | "fixed";

function fmtNairaFromKobo(kobo: number) {
  const n = Number(kobo || 0) / 100;
  try {
    return `₦${n.toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function toMsDateInput(v: string) {
  // v = "YYYY-MM-DD"
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export default function VendorCouponsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<any>(null);

  const [coupons, setCoupons] = useState<any[]>([]);

  // create/update form
  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percent");

  const [percent, setPercent] = useState(10);
  const [amountOffNgn, setAmountOffNgn] = useState(1000);

  const [minOrderNgn, setMinOrderNgn] = useState(0);
  const [maxDiscountNgn, setMaxDiscountNgn] = useState(0);
  const [usageLimitTotal, setUsageLimitTotal] = useState<number>(0);

  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");

  const [active, setActive] = useState(true);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await rMe.json().catch(() => ({}));
      if (!rMe.ok) throw new Error(meData?.error || "Failed to load profile");
      setMe(meData.me);

      const data = await authedFetch("/api/vendor/coupons");
      setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOwner = useMemo(() => String(me?.role || "") === "owner", [me]);

  async function saveCoupon() {
    setSaving(true);
    setMsg(null);
    try {
      const payload: any = {
        code: code.trim().toUpperCase(),
        active,
        type,
        percent: type === "percent" ? clampInt(percent, 1, 90) : undefined,
        amountOffKobo: type === "fixed" ? Math.max(0, Math.floor(amountOffNgn * 100)) : undefined,
        minOrderKobo: Math.max(0, Math.floor(minOrderNgn * 100)),
        maxDiscountKobo: maxDiscountNgn > 0 ? Math.floor(maxDiscountNgn * 100) : 0,
        usageLimitTotal: usageLimitTotal > 0 ? usageLimitTotal : null,
        startsAtMs: startsAt ? toMsDateInput(startsAt) : null,
        endsAtMs: endsAt ? toMsDateInput(endsAt) : null,
      };

      await authedFetch("/api/vendor/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMsg("Saved coupon.");
      setCode("");
      await load();
    } catch (e: any) {
      // subscription required handling
      if (String(e?.message || "").includes("SUBSCRIPTION_REQUIRED")) {
        setMsg("Subscribe to create discount codes.");
      } else {
        setMsg(e?.message || "Failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: any) {
    setMsg(null);
    try {
      const payload: any = {
        code: String(c.codeUpper || c.code || "").toUpperCase(),
        active: !(c.active === false),
        type: String(c.type || "percent"),
        percent: c.percent ?? 10,
        amountOffKobo: c.amountOffKobo ?? 0,
        minOrderKobo: c.minOrderKobo ?? 0,
        maxDiscountKobo: c.maxDiscountKobo ?? 0,
        usageLimitTotal: c.usageLimitTotal ?? null,
        startsAtMs: c.startsAtMs ?? null,
        endsAtMs: c.endsAtMs ?? null,
      };

      await authedFetch("/api/vendor/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Discounts" subtitle="Create coupon codes for checkout" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? (
          <Card className="p-4">
            <p className="text-sm font-bold text-biz-ink">Notice</p>
            <p className="text-sm text-gray-700 mt-2">{msg}</p>
            {msg.toLowerCase().includes("subscribe") ? (
              <div className="mt-3">
                <Button onClick={() => router.push("/vendor/subscription")}>Upgrade</Button>
              </div>
            ) : null}
          </Card>
        ) : null}

        {!loading && !isOwner ? (
          <Card className="p-4">
            <p className="text-sm font-bold text-biz-ink">Owner only</p>
            <p className="text-xs text-biz-muted mt-1">Only the owner can create and manage coupons.</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => router.push("/vendor")}>
                Back
              </Button>
            </div>
          </Card>
        ) : null}

        {!loading && isOwner ? (
          <>
            <SectionCard title="Create coupon" subtitle="Subscription required">
              <div className="space-y-2">
                <Input placeholder="CODE (e.g. SAVE10)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />

                <SegmentedControl<CouponType>
                  value={type}
                  onChange={setType}
                  options={[
                    { value: "percent", label: "Percent" },
                    { value: "fixed", label: "Fixed" },
                  ]}
                />

                {type === "percent" ? (
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    placeholder="Percent off (1–90)"
                    value={String(percent)}
                    onChange={(e) => setPercent(Number(e.target.value))}
                  />
                ) : (
                  <Input
                    type="number"
                    min={100}
                    step={100}
                    placeholder="Amount off (NGN)"
                    value={String(amountOffNgn)}
                    onChange={(e) => setAmountOffNgn(Number(e.target.value))}
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    placeholder="Min order (NGN)"
                    value={String(minOrderNgn)}
                    onChange={(e) => setMinOrderNgn(Number(e.target.value))}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    placeholder="Max discount (NGN, optional)"
                    value={String(maxDiscountNgn)}
                    onChange={(e) => setMaxDiscountNgn(Number(e.target.value))}
                  />
                </div>

                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Usage limit total (optional)"
                  value={String(usageLimitTotal)}
                  onChange={(e) => setUsageLimitTotal(Number(e.target.value))}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] text-biz-muted mb-1">Start date (optional)</p>
                    <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                  </div>
                  <div>
                    <p className="text-[11px] text-biz-muted mb-1">End date (optional)</p>
                    <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-biz-line bg-white p-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-biz-ink">Active</p>
                  <button
                    className={active ? "px-3 py-2 rounded-2xl text-xs font-bold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent" : "px-3 py-2 rounded-2xl text-xs font-bold border border-biz-line bg-white"}
                    onClick={() => setActive((v) => !v)}
                    type="button"
                  >
                    {active ? "ON" : "OFF"}
                  </button>
                </div>

                <Button onClick={saveCoupon} loading={saving} disabled={saving || !code.trim()}>
                  Save coupon
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Your coupons" subtitle="Tap to toggle active">
              {coupons.length === 0 ? (
                <p className="text-sm text-biz-muted">No coupons yet.</p>
              ) : (
                <div className="space-y-2">
                  {coupons.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition"
                      onClick={() => toggleActive(c)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-biz-ink">{String(c.codeUpper || c.code || c.id)}</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {c.type === "fixed"
                              ? `Fixed: ${fmtNairaFromKobo(Number(c.amountOffKobo || 0))}`
                              : `Percent: ${Number(c.percent || 0)}%`}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Used: <b className="text-biz-ink">{Number(c.usedCount || 0)}</b>
                            {c.usageLimitTotal ? ` / ${Number(c.usageLimitTotal)}` : ""}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={
                              c.active === false
                                ? "inline-flex px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100"
                                : "inline-flex px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"
                            }
                          >
                            {c.active === false ? "Inactive" : "Active"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}