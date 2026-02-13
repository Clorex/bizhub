"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Tag, ToggleLeft, ToggleRight, Plus, RefreshCw } from "lucide-react";

type CouponType = "percent" | "fixed";

function fmtNairaFromKobo(kobo: number) {
  const n = Number(kobo || 0) / 100;
  try {
    return `\u20A6${n.toLocaleString("en-NG")}`;
  } catch {
    return `\u20A6${n}`;
  }
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function toMsDateInput(v: string) {
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

// Validation
type FormErrors = {
  code?: string;
  percent?: string;
  amountOffNgn?: string;
  minOrderNgn?: string;
  maxDiscountNgn?: string;
  usageLimitTotal?: string;
  endsAt?: string;
};

function validateForm(params: {
  code: string;
  type: CouponType;
  percent: number;
  amountOffNgn: number;
  minOrderNgn: number;
  maxDiscountNgn: number;
  usageLimitTotal: number;
  startsAt: string;
  endsAt: string;
}): FormErrors {
  const errors: FormErrors = {};

  // Code: required, uppercase letters/numbers only, no spaces
  const trimmed = params.code.trim();
  if (!trimmed) {
    errors.code = "Coupon code is required.";
  } else if (!/^[A-Z0-9]+$/.test(trimmed)) {
    errors.code = "Only uppercase letters and numbers (no spaces or symbols).";
  } else if (trimmed.length < 3) {
    errors.code = "Code must be at least 3 characters.";
  } else if (trimmed.length > 20) {
    errors.code = "Code must be 20 characters or less.";
  }

  // Discount value
  if (params.type === "percent") {
    if (params.percent < 1 || params.percent > 90) {
      errors.percent = "Percent must be between 1 and 90.";
    }
  } else {
    if (params.amountOffNgn < 100) {
      errors.amountOffNgn = "Amount off must be at least \u20A6100.";
    }
  }

  // Min order
  if (params.minOrderNgn < 0) {
    errors.minOrderNgn = "Minimum order cannot be negative.";
  }

  // Max discount
  if (params.maxDiscountNgn < 0) {
    errors.maxDiscountNgn = "Maximum discount cannot be negative.";
  }

  // Usage limit
  if (params.usageLimitTotal < 0) {
    errors.usageLimitTotal = "Usage limit cannot be negative.";
  }

  // Dates
  if (params.startsAt && params.endsAt) {
    const startMs = toMsDateInput(params.startsAt);
    const endMs = toMsDateInput(params.endsAt);
    if (startMs && endMs && endMs <= startMs) {
      errors.endsAt = "End date must be after start date.";
    }
  }

  return errors;
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

  // Inline errors
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);

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
  }, []);

  // Re-validate when form changes (only if user has attempted to submit)
  useEffect(() => {
    if (!touched) return;
    const e = validateForm({ code, type, percent, amountOffNgn, minOrderNgn, maxDiscountNgn, usageLimitTotal, startsAt, endsAt });
    setErrors(e);
  }, [code, type, percent, amountOffNgn, minOrderNgn, maxDiscountNgn, usageLimitTotal, startsAt, endsAt, touched]);

  const isOwner = useMemo(() => String(me?.role || "") === "owner", [me]);

  const hasErrors = Object.keys(errors).length > 0;

  async function saveCoupon() {
    setTouched(true);

    const e = validateForm({ code, type, percent, amountOffNgn, minOrderNgn, maxDiscountNgn, usageLimitTotal, startsAt, endsAt });
    setErrors(e);

    if (Object.keys(e).length > 0) {
      toast.error("Please fix the errors before saving.");
      return;
    }

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

      toast.success("Coupon saved!");
      setCode("");
      setPercent(10);
      setAmountOffNgn(1000);
      setMinOrderNgn(0);
      setMaxDiscountNgn(0);
      setUsageLimitTotal(0);
      setStartsAt("");
      setEndsAt("");
      setActive(true);
      setTouched(false);
      setErrors({});
      await load();
    } catch (e: any) {
      const m = String(e?.message || "Failed to save coupon.");
      setMsg(m);
      toast.error(m);
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

      toast.success(c.active === false ? "Coupon activated." : "Coupon deactivated.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader title="Coupon codes" subtitle="Discount codes for checkout" showBack={true} />

      <div className="px-4 pb-24 space-y-4">
        {loading ? (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-orange-300 border-t-transparent animate-spin" />
              <span className="text-sm text-gray-500">Loading coupons...</span>
            </div>
          </Card>
        ) : null}

        {msg && !loading ? (
          <Card className="p-4">
            <p className="text-sm text-red-700">{msg}</p>
          </Card>
        ) : null}

        {!loading && !isOwner ? (
          <Card variant="soft" className="p-5">
            <p className="text-sm font-extrabold text-gray-900">Owner only</p>
            <p className="text-xs text-gray-500 mt-1">Only the store owner can create and manage coupon codes.</p>
            <div className="mt-4">
              <Button variant="secondary" onClick={() => router.push("/vendor")}>
                Back to dashboard
              </Button>
            </div>
          </Card>
        ) : null}

        {!loading && isOwner ? (
          <>
            {/* ──────────── Create coupon form ──────────── */}
            <SectionCard title="Create coupon" subtitle="Customers enter this code at checkout to get a discount">
              <div className="space-y-3">
                {/* Code */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Coupon code</label>
                  <Input
                    placeholder="e.g. SAVE10"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    maxLength={20}
                  />
                  {touched && errors.code ? (
                    <p className="text-[11px] text-red-600 mt-1">{errors.code}</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-1">Letters and numbers only, no spaces (e.g. SAVE10, WELCOME, FLASH50)</p>
                  )}
                </div>

                {/* Type */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Discount type</label>
                  <SegmentedControl<CouponType>
                    value={type}
                    onChange={setType}
                    options={[
                      { value: "percent", label: "Percentage off" },
                      { value: "fixed", label: "Fixed amount off" },
                    ]}
                  />
                </div>

                {/* Discount value */}
                {type === "percent" ? (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Percentage off (%)</label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      placeholder="e.g. 10"
                      value={String(percent)}
                      onChange={(e) => setPercent(Number(e.target.value))}
                    />
                    {touched && errors.percent ? (
                      <p className="text-[11px] text-red-600 mt-1">{errors.percent}</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">Enter a value between 1 and 90</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount off (\u20A6)</label>
                    <Input
                      type="number"
                      min={100}
                      step={100}
                      placeholder="e.g. 2000"
                      value={String(amountOffNgn)}
                      onChange={(e) => setAmountOffNgn(Number(e.target.value))}
                    />
                    {touched && errors.amountOffNgn ? (
                      <p className="text-[11px] text-red-600 mt-1">{errors.amountOffNgn}</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">The fixed naira amount to deduct from the order total</p>
                    )}
                  </div>
                )}

                {/* Min order + Max discount */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Min. order (\u20A6) <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={500}
                      placeholder="e.g. 5000"
                      value={String(minOrderNgn)}
                      onChange={(e) => setMinOrderNgn(Number(e.target.value))}
                    />
                    {touched && errors.minOrderNgn ? (
                      <p className="text-[11px] text-red-600 mt-1">{errors.minOrderNgn}</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">0 = no minimum</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Max. discount (\u20A6) <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={500}
                      placeholder="e.g. 3000"
                      value={String(maxDiscountNgn)}
                      onChange={(e) => setMaxDiscountNgn(Number(e.target.value))}
                    />
                    {touched && errors.maxDiscountNgn ? (
                      <p className="text-[11px] text-red-600 mt-1">{errors.maxDiscountNgn}</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">0 = no cap on discount</p>
                    )}
                  </div>
                </div>

                {/* Usage limit */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Usage limit <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 50"
                    value={usageLimitTotal > 0 ? String(usageLimitTotal) : ""}
                    onChange={(e) => setUsageLimitTotal(e.target.value ? Number(e.target.value) : 0)}
                  />
                  {touched && errors.usageLimitTotal ? (
                    <p className="text-[11px] text-red-600 mt-1">{errors.usageLimitTotal}</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-1">Total number of times this code can be used (0 = unlimited)</p>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Start date <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank for immediate</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      End date <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                    {touched && errors.endsAt ? (
                      <p className="text-[11px] text-red-600 mt-1">{errors.endsAt}</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">Leave blank for no expiry</p>
                    )}
                  </div>
                </div>

                {/* Active toggle */}
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-2xl px-4 py-3 flex items-center justify-between transition",
                    active
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-white border border-gray-200"
                  )}
                  onClick={() => setActive((v) => !v)}
                  disabled={saving}
                >
                  <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    {active ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                    {active ? "Active \u2014 customers can use this code" : "Inactive \u2014 code is disabled"}
                  </span>
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                      active
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    )}
                  >
                    {active ? "ON" : "OFF"}
                  </span>
                </button>

                <Button onClick={saveCoupon} loading={saving} disabled={saving || (touched && hasErrors)}>
                  {saving ? "Saving..." : "Save coupon"}
                </Button>
              </div>
            </SectionCard>

            {/* ──────────── Empty state ──────────── */}
            {!loading && coupons.length === 0 ? (
              <Card className="p-6 text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
                    <Tag className="w-7 h-7 text-orange-500" />
                  </div>
                </div>
                <p className="text-sm font-bold text-gray-900">No coupons yet</p>
                <p className="text-xs text-gray-500 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
                  Create a coupon code to give your customers discounts at checkout.
                  Share the code on your social media or with loyal customers to drive more sales.
                </p>
              </Card>
            ) : null}

            {/* ──────────── Existing coupons ──────────── */}
            {coupons.length > 0 ? (
              <SectionCard
                title="Your coupons"
                subtitle={`${coupons.length} coupon${coupons.length !== 1 ? "s" : ""}`}
                right={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={load}
                    disabled={loading || saving}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Refresh
                  </Button>
                }
              >
                <div className="space-y-2">
                  {coupons.map((c) => {
                    const isActive = c.active !== false;
                    const usageCount = Number(c.usageCount || 0);
                    const usageLimit = Number(c.usageLimitTotal || 0);

                    return (
                      <button
                        key={c.id}
                        className={cn(
                          "w-full text-left rounded-2xl border bg-white p-4 hover:bg-gray-50/50 transition",
                          isActive ? "border-emerald-200" : "border-gray-100"
                        )}
                        onClick={() => toggleActive(c)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-extrabold text-gray-900 font-mono tracking-wide">
                                {String(c.codeUpper || c.code || c.id)}
                              </p>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                  isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-gray-100 text-gray-500 border border-gray-200"
                                )}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <p className="text-xs text-gray-600 mt-1.5">
                              {c.type === "fixed"
                                ? `${fmtNairaFromKobo(Number(c.amountOffKobo || 0))} off`
                                : `${Number(c.percent || 0)}% off`}
                              {Number(c.minOrderKobo || 0) > 0 && (
                                <span className="text-gray-400"> &bull; Min. order: {fmtNairaFromKobo(c.minOrderKobo)}</span>
                              )}
                            </p>

                            {usageLimit > 0 && (
                              <p className="text-[11px] text-gray-400 mt-1">
                                Used {usageCount} / {usageLimit} times
                              </p>
                            )}
                          </div>

                          <p className="text-[11px] text-gray-400 shrink-0">Tap to toggle</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
