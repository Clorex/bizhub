// FILE: src/app/vendor/products/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";

import { Plus, RefreshCw, Search, Megaphone, Share2, Copy, Lock } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "warn"
        ? "bg-orange-50 text-orange-700 border-orange-100"
        : "bg-white text-gray-700 border-biz-line";

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${cls}`}>
      {children}
    </span>
  );
}

function waShareLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function buildShareCaption(p: any) {
  const name = String(p?.name || "Product");
  const price = Number(p?.price || 0);
  const slug = String(p?.businessSlug || "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = slug && p?.id ? `${origin}/b/${slug}/p/${p.id}` : "";

  const lines: string[] = [];
  lines.push(name);
  if (price > 0) lines.push(`Price: ${fmtNaira(price)}`);
  if (link) lines.push(`Link: ${link}`);
  lines.push(`(You can checkout securely via BizHub)`);

  return lines.join("\n");
}

export default function VendorProductsPage() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");

  // plan info (to show “not visible on market” notice)
  const [planKey, setPlanKey] = useState<string>("FREE");
  const [features, setFeatures] = useState<any>(null);

  // Share modal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [shareTitle, setShareTitle] = useState("");

  async function load() {
    try {
      setLoading(true);
      setMsg(null);

      const token = await auth.currentUser?.getIdToken();

      const [pRes, prodRes] = await Promise.all([
        fetch("/api/vendor/access", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/vendor/products", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const pData = await pRes.json().catch(() => ({}));
      const data = await prodRes.json().catch(() => ({}));

      if (!pRes.ok) throw new Error(pData?.error || "Failed to load access");
      if (!prodRes.ok) throw new Error(data?.error || "Failed to load products");

      setPlanKey(String(pData?.planKey || "FREE"));
      setFeatures(pData?.features || null);

      setItems(Array.isArray(data.products) ? data.products : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((p) => String(p?.name || "").toLowerCase().includes(t));
  }, [items, q]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied.");
      setTimeout(() => setMsg(null), 1200);
    } catch {
      setMsg("Copy failed.");
      setTimeout(() => setMsg(null), 1200);
    }
  }

  function openShare(p: any) {
    const caption = buildShareCaption(p);
    setShareTitle(String(p?.name || "Share"));
    setShareText(caption);
    setShareOpen(true);
  }

  const marketOn = !!features?.marketplace;

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Products"
        subtitle="Create, manage, and promote"
        showBack={false}
        right={
          <div className="flex items-center gap-2">
            <IconButton aria-label="Refresh" onClick={load} disabled={loading}>
              <RefreshCw className="h-5 w-5 text-gray-700" />
            </IconButton>
            <IconButton aria-label="Add product" onClick={() => router.push("/vendor/products/new")}>
              <Plus className="h-5 w-5 text-gray-700" />
            </IconButton>
          </div>
        }
      />

      <div className="px-4 pb-6 space-y-3">
        {msg ? <Card className="p-4">{msg}</Card> : null}

        {/* Notice: FREE products not in marketplace */}
        {!marketOn ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center">
                <Lock className="h-5 w-5 text-orange-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-biz-ink">Marketplace visibility is off</p>
                <p className="text-xs text-biz-muted mt-1">
                  Your products can be sold with your store link, but they won’t appear in the marketplace on your current plan.
                  Upgrade to show products on Market.
                </p>
                <div className="mt-3">
                  <Button onClick={() => router.push("/vendor/subscription")}>Upgrade</Button>
                </div>
                <p className="mt-2 text-[11px] text-biz-muted">Plan: <b className="text-biz-ink">{planKey}</b></p>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center border border-transparent">
              <Search className="h-5 w-5 text-orange-700" />
            </div>
            <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => router.push("/vendor/products/new")} leftIcon={<Plus className="h-4 w-4" />}>
              Add product
            </Button>
            <Button variant="secondary" onClick={load} loading={loading}>
              Refresh
            </Button>
          </div>

          <div className="mt-3 rounded-2xl border border-biz-line bg-white p-3">
            <p className="text-xs text-biz-muted">
              Tip: Use <b className="text-biz-ink">Share</b> to send a ready caption + link to customers on WhatsApp.
            </p>
          </div>
        </Card>

        {loading && items.length === 0 ? <Card className="p-4">Loading…</Card> : null}

        {!loading && items.length === 0 ? (
          <EmptyState title="No products yet" description="Add your first product to start selling and promoting." ctaLabel="Add product" onCta={() => router.push("/vendor/products/new")} />
        ) : null}

        {!loading && items.length > 0 && filtered.length === 0 ? (
          <EmptyState title="No matches" description="Try a different keyword." ctaLabel="Clear search" onCta={() => setQ("")} />
        ) : null}

        <div className="space-y-3">
          {filtered.map((p) => {
            const marketEnabled = p?.marketEnabled !== false;
            const slug = String(p?.businessSlug || "");
            const img = Array.isArray(p?.images) ? p.images[0] : "";
            const isService = String(p?.listingType || "product") === "service";
            const boosted = Number(p?.boostUntilMs || 0) > Date.now();

            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-biz-cream overflow-hidden shrink-0">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p?.name || "Product"} className="h-full w-full object-cover" />
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-biz-ink truncate">{p?.name || "Unnamed product"}</p>

                      <div className="flex items-center gap-2">
                        {boosted ? <Chip tone="good">Promoted</Chip> : null}
                        <Chip tone={marketEnabled ? "neutral" : "warn"}>{marketEnabled ? "Market: On" : "Market: Off"}</Chip>
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 mt-1">
                      {isService ? "Service" : fmtNaira(p?.price || 0)} • Stock: <b>{Number(p?.stock ?? 0)}</b>
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Chip>{p?.packaging || "Packaging"}</Chip>
                      {isService ? <Chip>Service</Chip> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/vendor/products/${p.id}/edit`)}>
                    Edit
                  </Button>

                  <Button variant="secondary" size="sm" onClick={() => router.push(`/b/${slug}/p/${p.id}`)} disabled={!slug}>
                    View
                  </Button>

                  <Button
                    size="sm"
                    leftIcon={<Megaphone className="h-4 w-4" />}
                    onClick={() => router.push(`/vendor/promote?productId=${encodeURIComponent(p.id)}`)}
                    disabled={isService}
                  >
                    Promote
                  </Button>

                  <Button size="sm" variant="secondary" leftIcon={<Share2 className="h-4 w-4" />} onClick={() => openShare(p)} disabled={!slug}>
                    Share
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {shareOpen ? (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
            <div className="w-full max-w-[430px] px-4 safe-pb pb-4">
              <Card className="p-4">
                <p className="text-sm font-bold text-biz-ink">{shareTitle}</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  This caption is auto-generated. You can edit or remove parts before sending.
                </p>

                <textarea
                  className="mt-3 w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                  value={shareText}
                  onChange={(e) => setShareText(e.target.value)}
                  rows={7}
                />

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" leftIcon={<Copy className="h-4 w-4" />} onClick={() => copyText(shareText)}>
                    Copy
                  </Button>

                  <Button onClick={() => window.open(waShareLink(shareText), "_blank")}>WhatsApp</Button>

                  <Button variant="secondary" onClick={() => setShareOpen(false)} className="col-span-2">
                    Close
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}