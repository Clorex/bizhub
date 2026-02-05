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
import { cloudinaryOptimizedUrl } from "@/lib/cloudinary/url";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString("en-NG")}`;
  } catch {
    return `₦${n}`;
  }
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "warn"
        ? "bg-orange-50 text-orange-700 border-orange-100"
        : "bg-white text-gray-700 border-biz-line";

  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${cls}`}>{children}</span>;
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
  lines.push(`(You can checkout securely via myBizHub)`);

  return lines.join("\n");
}

type Access = {
  ok?: boolean;
  role?: "owner" | "staff" | string;
  planKey?: string;
  features?: any;
  staff?: {
    staffJobTitle?: string | null;
    staffPermissions?: {
      productsView?: boolean;
      productsManage?: boolean;
      [k: string]: any;
    } | null;
  } | null;
};

export default function VendorProductsPage() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");

  const [access, setAccess] = useState<Access | null>(null);
  const [planKey, setPlanKey] = useState<string>("—");
  const [features, setFeatures] = useState<any>(null);

  const [prodError, setProdError] = useState<string | null>(null);
  const [prodStatus, setProdStatus] = useState<number | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [shareTitle, setShareTitle] = useState("");

  const role = String(access?.role || "");
  const staffPerms = (access?.staff?.staffPermissions && typeof access.staff.staffPermissions === "object"
    ? access.staff.staffPermissions
    : {}) as any;

  const canManage = role === "owner" || !!staffPerms.productsManage;
  const canView = role === "owner" || !!staffPerms.productsView || !!staffPerms.productsManage;

  async function load() {
    setLoading(true);
    setMsg(null);
    setProdError(null);
    setProdStatus(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        router.replace("/account/login?next=" + encodeURIComponent("/vendor/products"));
        return;
      }

      // 1) Load access FIRST (so planKey/features are correct even if products is forbidden)
      const pRes = await fetch("/api/vendor/access", { headers: { Authorization: `Bearer ${token}` } });
      const pData = (await pRes.json().catch(() => ({}))) as any;
      if (!pRes.ok) throw new Error(pData?.error || "Failed to load access");

      setAccess(pData);
      setPlanKey(String(pData?.planKey || "FREE").toUpperCase());
      setFeatures(pData?.features || {});

      // 2) Load products (may be forbidden for some staff)
      const prodRes = await fetch("/api/vendor/products", { headers: { Authorization: `Bearer ${token}` } });
      const data = await prodRes.json().catch(() => ({}));

      if (!prodRes.ok) {
        setProdStatus(prodRes.status);
        setProdError(String(data?.error || "Failed to load products"));
        setItems([]);
        return;
      }

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
  const showMarketplaceLock = access && !marketOn;

  const showNotAuthorized =
    (prodStatus === 403 || String(prodError || "").toLowerCase().includes("not authorized")) && !!access;

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

            <IconButton
              aria-label="Add product"
              onClick={() => (canManage ? router.push("/vendor/products/new") : undefined)}
              disabled={!canManage}
              title={!canManage ? "You don’t have permission to add products" : "Add product"}
            >
              <Plus className="h-5 w-5 text-gray-700" />
            </IconButton>
          </div>
        }
      />

      <div className="px-4 pb-6 space-y-3">
        {msg ? <Card className="p-4">{msg}</Card> : null}

        {showNotAuthorized ? (
          <Card className="p-4">
            <p className="text-sm font-bold text-biz-ink">Not authorized</p>
            <p className="text-xs text-biz-muted mt-1">
              Your staff account doesn’t have permission to view/manage products.
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              Plan: <b className="text-biz-ink">{planKey}</b>
              {role === "staff" && access?.staff?.staffJobTitle ? (
                <>
                  {" "}
                  • Role: <b className="text-biz-ink">{String(access.staff.staffJobTitle)}</b>
                </>
              ) : null}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={() => router.push("/vendor")}>
                Back to dashboard
              </Button>
              <Button variant="secondary" onClick={load} disabled={loading}>
                Retry
              </Button>
            </div>
          </Card>
        ) : null}

        {showMarketplaceLock ? (
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
                <p className="mt-2 text-[11px] text-biz-muted">
                  Plan: <b className="text-biz-ink">{planKey}</b>
                </p>
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
            <Button
              onClick={() => (canManage ? router.push("/vendor/products/new") : undefined)}
              leftIcon={<Plus className="h-4 w-4" />}
              disabled={!canManage}
            >
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
            <p className="text-[11px] text-gray-500 mt-2">
              Plan: <b className="text-biz-ink">{planKey}</b>
            </p>
          </div>
        </Card>

        {loading && items.length === 0 ? <Card className="p-4">Loading…</Card> : null}

        {!loading && !showNotAuthorized && prodError ? (
          <Card className="p-4 text-red-700">
            {prodError}
          </Card>
        ) : null}

        {!loading && !showNotAuthorized && items.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Add your first product to start selling and promoting."
            ctaLabel={canManage ? "Add product" : "Back to dashboard"}
            onCta={() => (canManage ? router.push("/vendor/products/new") : router.push("/vendor"))}
          />
        ) : null}

        {!loading && items.length > 0 && filtered.length === 0 ? (
          <EmptyState title="No matches" description="Try a different keyword." ctaLabel="Clear search" onCta={() => setQ("")} />
        ) : null}

        <div className="space-y-3">
          {filtered.map((p) => {
            const marketEnabled = p?.marketEnabled !== false;
            const slug = String(p?.businessSlug || "");
            const imgRaw = Array.isArray(p?.images) ? p.images[0] : "";
            const img = imgRaw ? cloudinaryOptimizedUrl(imgRaw, { w: 160, h: 160 }) : "";
            const isService = String(p?.listingType || "product") === "service";
            const boosted = Number(p?.boostUntilMs || 0) > Date.now();

            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-biz-cream overflow-hidden shrink-0">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p?.name || "Product"} className="h-full w-full object-cover" loading="lazy" decoding="async" />
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => (canManage ? router.push(`/vendor/products/${p.id}/edit`) : undefined)}
                    disabled={!canManage}
                  >
                    Edit
                  </Button>

                  <Button variant="secondary" size="sm" onClick={() => router.push(`/b/${slug}/p/${p.id}`)} disabled={!slug}>
                    View
                  </Button>

                  <Button
                    size="sm"
                    leftIcon={<Megaphone className="h-4 w-4" />}
                    onClick={() => (canManage ? router.push(`/vendor/promote?productId=${encodeURIComponent(p.id)}`) : undefined)}
                    disabled={!canManage || isService}
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
                <p className="text-[11px] text-biz-muted mt-1">This caption is auto-generated. You can edit before sending.</p>

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