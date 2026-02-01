"use client";



import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { CheckCircle2, HelpCircle, Megaphone } from "lucide-react";

type Tab = "setup" | "summary";

function fmtNaira(n: number) {
  try {
    return `â‚¦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `â‚¦${n}`;
  }
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export default function PromoteWizardPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const presetProductId = sp.get("productId");
  const presetIds = parseIds(sp.get("ids"));
  const presetDays = sp.get("days");
  const presetDaily = sp.get("daily");

  const [tab, setTab] = useState<Tab>("setup");

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [days, setDays] = useState<number>(2);
  const [dailyBudget, setDailyBudget] = useState<number>(1700);
  const maxProducts = 5;

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setMsg(null);
      try {
        const data = await authedFetch("/api/vendor/products");
        const list = Array.isArray(data.products) ? data.products : [];
        const onlyProducts = list.filter((p: any) => String(p?.listingType || "product") !== "service");

        if (!mounted) return;
        setProducts(onlyProducts);

        // Apply presets
        const nextIds: string[] = [];

        // ids=... takes priority
        for (const id of presetIds) {
          const exists = onlyProducts.some((p: any) => String(p.id) === id);
          if (exists) nextIds.push(id);
        }

        // fallback: productId
        if (nextIds.length === 0 && presetProductId) {
          const exists = onlyProducts.some((p: any) => String(p.id) === String(presetProductId));
          if (exists) nextIds.push(String(presetProductId));
        }

        if (nextIds.length) setSelectedIds(nextIds.slice(0, maxProducts));

        if (presetDays) setDays(clampInt(presetDays, 2, 60));
        if (presetDaily) setDailyBudget(clampInt(presetDaily, 1700, 500000));
      } catch (e: any) {
        if (!mounted) return;
        setMsg(e?.message || "Failed to load products");
        setProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [presetProductId, presetDays, presetDaily]); // presetIds is derived from query; safe

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= maxProducts) return prev;
      return [...prev, id];
    });
  }

  const selectedProducts = useMemo(() => {
    const map = new Map(products.map((p) => [String(p.id), p]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [products, selectedIds]);

  const safeDays = useMemo(() => clampInt(days, 2, 60), [days]);
  const safeDaily = useMemo(() => clampInt(dailyBudget, 1700, 500000), [dailyBudget]);

  const totalCost = useMemo(() => safeDays * safeDaily, [safeDays, safeDaily]);

  const exposureNote = useMemo(() => {
    if (selectedIds.length <= 1) {
      return "Higher daily budget increases how often your product appears in promoted slots.";
    }
    return "Your campaign will promote multiple products. Exposure is shared across selected products.";
  }, [selectedIds.length]);

  const canContinue =
    selectedIds.length >= 1 &&
    selectedIds.length <= maxProducts &&
    safeDays >= 2 &&
    safeDaily >= 1700;

  async function startPayment() {
    if (!canContinue) return;

    setPaying(true);
    setMsg(null);
    try {
      const data = await authedFetch("/api/promotions/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: selectedIds,
          days: safeDays,
          dailyBudgetKobo: safeDaily * 100,
        }),
      });

      window.location.href = data.authorization_url;
    } catch (e: any) {
      setMsg(e?.message || "Failed to start payment");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Promotion"
        subtitle="Boost a product like ads"
        showBack={true}
        right={
          <button
            className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-bold shadow-soft inline-flex items-center gap-2"
            onClick={() => router.push("/vendor/promote/faq")}
          >
            <HelpCircle className="h-4 w-4 text-gray-700" />
            FAQ
          </button>
        }
      />

      <div className="px-4 pb-6 space-y-3">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "setup", label: "Setup" },
            { value: "summary", label: "Summary" },
          ]}
        />

        {loading ? <Card className="p-4">Loadingâ€¦</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading ? (
          <>
            {tab === "setup" ? (
              <>
                <SectionCard
                  title="Select products"
                  subtitle={`Choose 1â€“${maxProducts} products to promote`}
                  right={
                    <span className="text-[11px] text-biz-muted">
                      Selected: <b className="text-biz-ink">{selectedIds.length}</b>/{maxProducts}
                    </span>
                  }
                >
                  {products.length === 0 ? (
                    <div className="text-sm text-biz-muted">
                      You have no products yet. Add a product first.
                      <div className="mt-3">
                        <Button onClick={() => router.push("/vendor/products/new")}>Add product</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {products.slice(0, 50).map((p: any) => {
                        const id = String(p.id);
                        const on = selectedIds.includes(id);
                        const img = Array.isArray(p?.images) ? p.images[0] : "";

                        return (
                          <button
                            key={id}
                            onClick={() => toggle(id)}
                            className={[
                              "w-full text-left rounded-2xl border p-3 transition",
                              on
                                ? "border-transparent bg-gradient-to-br from-biz-accent2 to-biz-accent text-white shadow-float"
                                : "border-biz-line bg-white hover:bg-black/[0.02]",
                            ].join(" ")}
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-12 w-12 rounded-2xl bg-biz-cream overflow-hidden shrink-0 border border-black/5">
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={img} alt={p?.name || "Product"} className="h-full w-full object-cover" />
                                ) : null}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className={on ? "text-sm font-bold" : "text-sm font-bold text-biz-ink"}>
                                  {p?.name || "Product"}
                                </p>
                                <p className={on ? "text-[11px] opacity-90 mt-1" : "text-[11px] text-biz-muted mt-1"}>
                                  â‚¦{Number(p?.price || 0).toLocaleString()}
                                </p>
                              </div>

                              {on ? (
                                <CheckCircle2 className="h-5 w-5 text-white shrink-0 mt-0.5" />
                              ) : (
                                <span className="h-5 w-5 rounded-full border border-biz-line bg-white shrink-0 mt-0.5" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p className="mt-3 text-[11px] text-biz-muted">
                    If you select multiple products, exposure is shared across them.
                  </p>
                </SectionCard>

                <SectionCard title="Budget & duration" subtitle="More budget = more exposure">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-biz-muted mb-1">Days (minimum 2)</p>
                      <Input
                        type="number"
                        min={2}
                        max={60}
                        value={String(days)}
                        onChange={(e) => setDays(Number(e.target.value))}
                        placeholder="2"
                      />
                    </div>

                    <div>
                      <p className="text-xs text-biz-muted mb-1">Daily budget (minimum â‚¦1,700)</p>
                      <Input
                        type="number"
                        min={1700}
                        step={100}
                        value={String(dailyBudget)}
                        onChange={(e) => setDailyBudget(Number(e.target.value))}
                        placeholder="1700"
                      />
                      <p className="mt-2 text-[11px] text-biz-muted">{exposureNote}</p>
                    </div>
                  </div>
                </SectionCard>

                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-biz-ink">Estimated total</p>
                      <p className="text-[11px] text-biz-muted mt-1">
                        {safeDays} day(s) Ã— {fmtNaira(safeDaily)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-biz-ink">{fmtNaira(totalCost)}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => setTab("summary")}
                      disabled={!canContinue}
                      leftIcon={<Megaphone className="h-4 w-4" />}
                    >
                      Continue
                    </Button>
                    <Button variant="secondary" onClick={() => router.push("/vendor/promotions")}>
                      Campaigns
                    </Button>
                  </div>

                  {!canContinue ? (
                    <p className="mt-2 text-[11px] text-red-700">
                      Select at least 1 product (max {maxProducts}), and use at least 2 days + â‚¦1,700/day.
                    </p>
                  ) : null}
                </Card>
              </>
            ) : null}

            {tab === "summary" ? (
              <>
                <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
                  <p className="text-xs opacity-95">Promotion summary</p>
                  <p className="text-xl font-bold mt-1">{fmtNaira(totalCost)}</p>
                  <p className="text-[11px] opacity-95 mt-2">
                    Duration: <b>{safeDays} day(s)</b> â€¢ Daily budget: <b>{fmtNaira(safeDaily)}</b>
                  </p>
                  <p className="text-[11px] opacity-95 mt-1">
                    Products: <b>{selectedIds.length}</b> (shared exposure if multiple)
                  </p>
                </div>

                <SectionCard title="Selected products" subtitle="These will be promoted">
                  <div className="space-y-2">
                    {selectedProducts.map((p: any) => (
                      <div key={String(p.id)} className="rounded-2xl border border-biz-line bg-white p-3">
                        <p className="text-sm font-bold text-biz-ink">{p?.name || "Product"}</p>
                        <p className="text-[11px] text-biz-muted mt-1">â‚¦{Number(p?.price || 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <div className="fixed bottom-0 left-0 right-0 z-40">
                  <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
                    <Card className="p-4 space-y-2">
                      <Button onClick={startPayment} loading={paying} disabled={!canContinue}>
                        Pay {fmtNaira(totalCost)}
                      </Button>
                      <Button variant="secondary" onClick={() => setTab("setup")}>
                        Edit campaign
                      </Button>
                    </Card>
                  </div>
                </div>

                <div className="h-28" />
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
