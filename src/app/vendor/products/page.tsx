"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { VendorEmptyState } from "@/components/vendor/EmptyState";
import { ListSkeleton } from "@/components/vendor/PageSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { cloudinaryOptimizedUrl } from "@/lib/cloudinary/url";
import { formatMoneyNGN } from "@/lib/money";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteVendorProduct } from "@/lib/vendor/productsClient";

import {
  Plus,
  RefreshCw,
  Search,
  Megaphone,
  Share2,
  Copy,
  Lock,
  Package,
  Eye,
  Edit3,
  ChevronRight,
  X,
  AlertCircle,
  Sparkles,
  MoreVertical,
  MessageCircle,
  Grid3X3,
  List,
  Trash2,
} from "lucide-react";

/* -------------------------------- Helpers -------------------------------- */

function fmtNaira(n: number) {
  return formatMoneyNGN(Number(n || 0));
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
  lines.push(`ðŸ›’ *${name}*`);
  if (price > 0) lines.push(`ðŸ’° Price: ${fmtNaira(price)}`);
  if (link) lines.push(`ðŸ”— ${link}`);
  lines.push("");
  lines.push("âœ… Secure checkout via myBizHub");

  return lines.join("\n");
}

/* -------------------------------- Types -------------------------------- */

type FilterType = "all" | "active" | "outofstock" | "lowstock" | "hidden";
type ViewMode = "list" | "grid";

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

type Category = { id: string; name: string; slug?: string };

/* -------------------------------- Main Component -------------------------------- */

export default function VendorProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const initialFilter = (searchParams.get("filter") as FilterType) || "all";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Shelves (vendor categories)
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all"); // all | uncat | <categoryId>
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catBusy, setCatBusy] = useState(false);

  const [access, setAccess] = useState<Access | null>(null);
  const [planKey, setPlanKey] = useState<string>("FREE");
  const [features, setFeatures] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // Share modal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProduct, setShareProduct] = useState<any>(null);
  const [shareText, setShareText] = useState("");

  // Action menu
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Delete flow
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  /* permissions */
  const role = String(access?.role || "");
  const staffPerms = access?.staff?.staffPermissions || {};
  const canManage = role === "owner" || !!staffPerms.productsManage;
  const canView = role === "owner" || !!staffPerms.productsView || !!staffPerms.productsManage;

  const openShare = useCallback((p: any) => {
    setShareProduct(p);
    setShareText(buildShareCaption(p));
    setShareOpen(true);
  }, []);

  const copyShareText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  }, [shareText]);

  const copyProductLink = useCallback(async (p: any) => {
    const slug = String(p?.businessSlug || "");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = slug && p?.id ? `${origin}/b/${slug}/p/${p.id}` : "";

    if (link) {
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Link copied!");
      } catch {
        toast.error("Failed to copy");
      }
    }
    setActionMenuOpen(null);
  }, []);

  async function reloadCategories(token: string) {
    try {
      const r = await fetch("/api/vendor/categories", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setCategories(Array.isArray(j?.categories) ? j.categories : []);
      else setCategories([]);
    } catch {
      setCategories([]);
    }
  }

  async function createCategory() {
    const name = String(catName || "").trim();
    if (!name) return;

    setCatBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const r = await fetch("/api/vendor/categories", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to create category");

      setCatName("");
      await reloadCategories(token);
      toast.success("Category created.");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setCatBusy(false);
    }
  }

  async function renameCategory(c: Category) {
    const current = String(c?.name || "").trim();
    const next = prompt("Rename category", current);
    if (!next || !next.trim() || next.trim() === current) return;

    setCatBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const r = await fetch(`/api/vendor/categories/${encodeURIComponent(String(c.id))}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: next.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to rename category");

      await reloadCategories(token);
      toast.success("Category renamed.");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setCatBusy(false);
    }
  }

  async function deleteCategory(c: Category) {
    const ok = confirm(`Delete category "${String(c?.name || "")}"? Products will become Uncategorized.`);
    if (!ok) return;

    setCatBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const r = await fetch(`/api/vendor/categories/${encodeURIComponent(String(c.id))}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to delete category");

      if (categoryFilter === String(c.id)) setCategoryFilter("all");
      await reloadCategories(token);
      toast.success("Category deleted.");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setCatBusy(false);
    }
  }

  /* load data */
  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setErrorStatus(null);

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          router.replace("/account/login?next=" + encodeURIComponent("/vendor/products"));
          return;
        }

        const accessRes = await fetch("/api/vendor/access", { headers: { Authorization: `Bearer ${token}` } });
        const accessData = await accessRes.json().catch(() => ({}));
        if (!accessRes.ok) throw new Error(accessData?.error || "Failed to load access");

        setAccess(accessData);
        setPlanKey(String(accessData?.planKey || "FREE").toUpperCase());
        setFeatures(accessData?.features || {});

        const prodRes = await fetch("/api/vendor/products", { headers: { Authorization: `Bearer ${token}` } });
        const prodData = await prodRes.json().catch(() => ({}));
        if (!prodRes.ok) {
          setErrorStatus(prodRes.status);
          setError(String(prodData?.error || "Failed to load products"));
          setItems([]);
          return;
        }

        setItems(Array.isArray(prodData.products) ? prodData.products : []);
        await reloadCategories(token);

        if (isRefresh) toast.success("Products refreshed!");
      } catch (e: any) {
        setError(e?.message || "Something went wrong");
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    load();
  }, [load]);

  /* filtered items */
  const filteredItems = useMemo(() => {
    let result = [...items];

    // shelves filter
    if (categoryFilter === "uncat") {
      result = result.filter((p) => !String(p?.categoryId || "").trim());
    } else if (categoryFilter !== "all") {
      result = result.filter((p) => String(p?.categoryId || "") === categoryFilter);
    }

    // existing status filters
    switch (filter) {
      case "active":
        result = result.filter((p) => p.marketEnabled !== false && (p.stock ?? 0) > 0);
        break;
      case "outofstock":
        result = result.filter((p) => (p.stock ?? 0) === 0);
        break;
      case "lowstock":
        result = result.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5);
        break;
      case "hidden":
        result = result.filter((p) => p.marketEnabled === false);
        break;
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) => String(p?.name || "").toLowerCase().includes(q) || String(p?.category || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, filter, searchQuery, categoryFilter]);

  /* stats */
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((p) => p.marketEnabled !== false && (p.stock ?? 0) > 0).length;
    const outOfStock = items.filter((p) => (p.stock ?? 0) === 0).length;
    const lowStock = items.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length;
    const hidden = items.filter((p) => p.marketEnabled === false).length;
    const boosted = items.filter((p) => Number(p.boostUntilMs || 0) > Date.now()).length;
    return { total, active, outOfStock, lowStock, hidden, boosted };
  }, [items]);

  /* derived states */
  const marketOn = !!features?.marketplace;
  const showMarketplaceLock = access && !marketOn;
  const showNotAuthorized = (errorStatus === 403 || error?.toLowerCase().includes("not authorized")) && !!access;

  function requestDelete(p: any) {
    if (!canManage) {
      toast.error("You don't have permission to delete products.");
      return;
    }
    setActionMenuOpen(null);
    setDeleteTarget(p);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    const id = String(deleteTarget?.id || "").trim();
    if (!id) {
      setDeleteOpen(false);
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    try {
      await deleteVendorProduct(id);
      setItems((prev) => prev.filter((x) => String(x?.id) !== id));
      toast.success("Product deleted.");
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Could not delete product.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Products" subtitle="Manage your catalog" showBack={false} />
        <ListSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Products"
        subtitle={`${stats.total} product${stats.total !== 1 ? "s" : ""}`}
        showBack={false}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
            </button>
            <button
              onClick={() => canManage && router.push("/vendor/products/new")}
              disabled={!canManage}
              className="w-10 h-10 rounded-xl bg-white flex items-center justify-center hover:bg-orange-50 transition disabled:opacity-50"
              aria-label="Add product"
            >
              <Plus className="w-5 h-5 text-orange-600" />
            </button>
          </div>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        {showNotAuthorized && (
          <Card className="p-5 bg-red-50 border-red-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Not Authorized</p>
                <p className="text-xs text-red-600 mt-1">Your account doesn't have permission to view or manage products.</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => router.push("/vendor")}>Dashboard</Button>
                  <Button size="sm" variant="secondary" onClick={() => load()}>Retry</Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {showMarketplaceLock && !showNotAuthorized && (
          <Card className="p-5 bg-orange-50 border-orange-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-800">Marketplace Locked</p>
                <p className="text-xs text-orange-700 mt-1">
                  Customers can still buy via your store link. Upgrade to list products on the public marketplace.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => router.push("/vendor/subscription")}>Upgrade plan</Button>
                  <Button size="sm" variant="secondary" onClick={() => router.push("/vendor")}>Dashboard</Button>
                </div>
                <p className="text-[11px] text-orange-600 mt-3">Current plan: <b>{planKey}</b></p>
              </div>
            </div>
          </Card>
        )}

        {error && !showNotAuthorized && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{error}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => load()}>Try again</Button>
              </div>
            </div>
          </Card>
        )}

        {!showNotAuthorized && (
          <>
            {stats.total > 0 && (
              <div className="grid grid-cols-4 gap-2">
                <StatBadge label="Active" value={stats.active} color="green" active={filter === "active"} onClick={() => setFilter(filter === "active" ? "all" : "active")} />
                <StatBadge label="Low Stock" value={stats.lowStock} color="orange" active={filter === "lowstock"} onClick={() => setFilter(filter === "lowstock" ? "all" : "lowstock")} />
                <StatBadge label="Out" value={stats.outOfStock} color="red" active={filter === "outofstock"} onClick={() => setFilter(filter === "outofstock" ? "all" : "outofstock")} />
                <StatBadge label="Hidden" value={stats.hidden} color="gray" active={filter === "hidden"} onClick={() => setFilter(filter === "hidden" ? "all" : "hidden")} />
              </div>
            )}

            {/* Shelves */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Shelves</p>
                <button onClick={() => setCatOpen(true)} className="text-xs font-bold text-orange-600 hover:text-orange-700">
                  Manage categories
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={cn(
                    "shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition",
                    categoryFilter === "all" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200 hover:border-orange-200"
                  )}
                >
                  All
                </button>

                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryFilter(c.id)}
                    className={cn(
                      "shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition",
                      categoryFilter === c.id ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200 hover:border-orange-200"
                    )}
                  >
                    {c.name}
                  </button>
                ))}

                {items.some((p) => !String(p?.categoryId || "").trim()) ? (
                  <button
                    onClick={() => setCategoryFilter("uncat")}
                    className={cn(
                      "shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition",
                      categoryFilter === "uncat" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200 hover:border-orange-200"
                    )}
                  >
                    Uncategorized
                  </button>
                ) : null}
              </div>
            </Card>

            {/* Search + View toggle */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      aria-label="Clear search"
                    >
                      <X className="w-3 h-3 text-gray-600" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition", viewMode === "list" ? "bg-white shadow-sm" : "hover:bg-gray-200")}
                    aria-label="List view"
                  >
                    <List className={cn("w-4 h-4", viewMode === "list" ? "text-orange-600" : "text-gray-500")} />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition", viewMode === "grid" ? "bg-white shadow-sm" : "hover:bg-gray-200")}
                    aria-label="Grid view"
                  >
                    <Grid3X3 className={cn("w-4 h-4", viewMode === "grid" ? "text-orange-600" : "text-gray-500")} />
                  </button>
                </div>
              </div>
            </Card>

            {stats.total === 0 && !error && (
              <Card className="p-0 overflow-hidden bg-gradient-to-br from-orange-50 to-white border-orange-100">
                <EmptyState
                  icon={<Package className="w-10 h-10 text-orange-600" />}
                  title="No products yet"
                  description="Add your first product to start selling."
                  actions={[
                    { label: "Add product", onClick: () => router.push("/vendor/products/new"), variant: "primary", leftIcon: <Plus className="w-4 h-4" /> },
                    { label: "Go to dashboard", onClick: () => router.push("/vendor"), variant: "secondary" },
                  ]}
                />
              </Card>
            )}

            {stats.total > 0 && filteredItems.length === 0 && (
              <VendorEmptyState
                icon={Search}
                title="No products found"
                description={searchQuery ? `No products match "${searchQuery}"` : "No products match this filter"}
                actions={[{ label: "Clear Filters", onClick: () => { setSearchQuery(""); setFilter("all"); setCategoryFilter("all"); }, variant: "secondary" }]}
              />
            )}

            {filteredItems.length > 0 && (
              <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                {filteredItems.map((product) =>
                  viewMode === "grid" ? (
                    <ProductGridCard
                      key={product.id}
                      product={product}
                      canManage={canManage}
                      actionMenuOpen={actionMenuOpen === product.id}
                      onActionMenuToggle={() => setActionMenuOpen(actionMenuOpen === product.id ? null : product.id)}
                      onEdit={() => router.push(`/vendor/products/${product.id}/edit`)}
                      onView={() => router.push(`/b/${product.businessSlug}/p/${product.id}`)}
                      onShare={() => openShare(product)}
                      onPromote={() => router.push(`/vendor/promote?productId=${product.id}`)}
                      onCopyLink={() => copyProductLink(product)}
                      onDelete={() => requestDelete(product)}
                    />
                  ) : (
                    <ProductListCard
                      key={product.id}
                      product={product}
                      canManage={canManage}
                      actionMenuOpen={actionMenuOpen === product.id}
                      onActionMenuToggle={() => setActionMenuOpen(actionMenuOpen === product.id ? null : product.id)}
                      onEdit={() => router.push(`/vendor/products/${product.id}/edit`)}
                      onView={() => router.push(`/b/${product.businessSlug}/p/${product.id}`)}
                      onShare={() => openShare(product)}
                      onPromote={() => router.push(`/vendor/promote?productId=${product.id}`)}
                      onCopyLink={() => copyProductLink(product)}
                      onDelete={() => requestDelete(product)}
                    />
                  )
                )}
              </div>
            )}

            {stats.boosted > 0 && (
              <Card className="p-4 bg-purple-50 border-purple-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-purple-800">
                      {stats.boosted} product{stats.boosted !== 1 ? "s" : ""} promoted
                    </p>
                    <p className="text-xs text-purple-600 mt-0.5">Getting extra visibility in the marketplace</p>
                  </div>
                  <button onClick={() => router.push("/vendor/promotions")} className="text-xs font-bold text-purple-700 flex items-center gap-1">
                    Manage <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Share Modal */}
      {shareOpen && shareProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setShareOpen(false)} />
          <div className="relative w-full max-w-[430px] mx-auto px-4 pb-safe mb-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">Share: {shareProduct.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Edit the message before sharing</p>
                </div>
                <button
                  onClick={() => setShareOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                  aria-label="Close share"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <textarea
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 resize-none"
                value={shareText}
                onChange={(e) => setShareText(e.target.value)}
                rows={6}
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={copyShareText} leftIcon={<Copy className="w-4 h-4" />}>
                  Copy text
                </Button>
                <Button
                  onClick={() => window.open(waShareLink(shareText), "_blank")}
                  leftIcon={<Share2 className="w-4 h-4" />}
                  className="bg-green-600 hover:bg-green-700"
                >
                  WhatsApp
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Manage categories modal */}
      {catOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => (!catBusy ? setCatOpen(false) : null)} />
          <div className="relative w-full max-w-[430px] mx-auto px-4 pb-safe mb-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Manage categories</p>
                <button className="text-xs font-bold text-gray-500" onClick={() => (!catBusy ? setCatOpen(false) : null)}>
                  Close
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <Input placeholder="New category name (e.g. Shoes)" value={catName} onChange={(e) => setCatName(e.target.value)} disabled={catBusy} />
                <Button onClick={createCategory} disabled={catBusy || !catName.trim()} loading={catBusy} className="w-auto px-4">
                  Add
                </Button>
              </div>

              <div className="mt-4 space-y-2 max-h-[45vh] overflow-auto">
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No categories yet</p>
                ) : (
                  categories.map((c) => (
                    <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => renameCategory(c)} disabled={catBusy} className="w-auto px-3">
                          Rename
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => deleteCategory(c)} disabled={catBusy} className="w-auto px-3">
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete product"
        description={
          deleteTarget?.name
            ? `Are you sure you want to delete this product?\n\n"${String(deleteTarget.name)}"\n\nThis cannot be undone.`
            : "Are you sure you want to delete this product?\n\nThis cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

/* -------------------------------- Stat Badge -------------------------------- */

function StatBadge({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: "green" | "orange" | "red" | "gray";
  active: boolean;
  onClick: () => void;
}) {
  const colorStyles = {
    green: active ? "bg-green-500 text-white border-green-500" : "bg-green-50 text-green-700 border-green-200 hover:border-green-300",
    orange: active ? "bg-orange-500 text-white border-orange-500" : "bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-300",
    red: active ? "bg-red-500 text-white border-red-500" : "bg-red-50 text-red-700 border-red-200 hover:border-red-300",
    gray: active ? "bg-gray-500 text-white border-gray-500" : "bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300",
  };

  return (
    <button onClick={onClick} className={cn("rounded-2xl border p-3 text-center transition", colorStyles[color])}>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5">{label}</p>
    </button>
  );
}

/* -------------------------------- Product List Card -------------------------------- */

function ProductListCard({
  product,
  canManage,
  actionMenuOpen,
  onActionMenuToggle,
  onEdit,
  onView,
  onShare,
  onPromote,
  onCopyLink,
  onDelete,
}: {
  product: any;
  canManage: boolean;
  actionMenuOpen: boolean;
  onActionMenuToggle: () => void;
  onEdit: () => void;
  onView: () => void;
  onShare: () => void;
  onPromote: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const imgRaw = Array.isArray(product.images) ? product.images[0] : "";
  const img = imgRaw ? cloudinaryOptimizedUrl(imgRaw, { w: 160, h: 160 }) : "";
  const isService = String(product.listingType || "product") === "service";
  const boosted = Number(product.boostUntilMs || 0) > Date.now();
  const stock = Number(product.stock ?? 0);
  const marketEnabled = product.marketEnabled !== false;

  const stockStatus = stock === 0 ? "out" : stock <= 5 ? "low" : "ok";

  return (
    <Card className="p-4 relative">
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden shrink-0">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={product.name || "Product"} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{product.name || "Unnamed"}</p>
              <p className="text-sm text-gray-600 mt-0.5">{isService ? "Service" : fmtNaira(product.price || 0)}</p>
            </div>

            <button onClick={onActionMenuToggle} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center shrink-0" aria-label="Product actions">
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {boosted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                <Sparkles className="w-3 h-3" />
                Promoted
              </span>
            )}
            {!marketEnabled && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">Hidden</span>}
            {!isService && (
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                stockStatus === "out" ? "bg-red-100 text-red-700" : stockStatus === "low" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
              )}>
                Stock: {stock}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Button size="sm" variant="secondary" onClick={onEdit} disabled={!canManage} leftIcon={<Edit3 className="w-3.5 h-3.5" />}>Edit</Button>
        <Button size="sm" variant="secondary" onClick={onView} leftIcon={<Eye className="w-3.5 h-3.5" />}>View</Button>
        <Button size="sm" variant="secondary" onClick={onShare} leftIcon={<Share2 className="w-3.5 h-3.5" />}>Share</Button>
        <Button size="sm" onClick={onPromote} disabled={!canManage || isService} leftIcon={<Megaphone className="w-3.5 h-3.5" />}>Boost</Button>
      </div>

      {actionMenuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onActionMenuToggle} />
          <div className="absolute right-4 top-14 z-20 w-52 rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
            <button onClick={onCopyLink} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition">
              <Copy className="w-4 h-4 text-gray-400" />
              Copy link
            </button>

            {canManage ? (
              <button onClick={onDelete} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-700 hover:bg-red-50 transition border-t border-gray-100">
                <Trash2 className="w-4 h-4 text-red-500" />
                Delete product
              </button>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

/* -------------------------------- Product Grid Card -------------------------------- */

function ProductGridCard({
  product,
  canManage,
  actionMenuOpen,
  onActionMenuToggle,
  onEdit,
  onView,
  onShare,
  onPromote,
  onCopyLink,
  onDelete,
}: {
  product: any;
  canManage: boolean;
  actionMenuOpen: boolean;
  onActionMenuToggle: () => void;
  onEdit: () => void;
  onView: () => void;
  onShare: () => void;
  onPromote: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const imgRaw = Array.isArray(product.images) ? product.images[0] : "";
  const img = imgRaw ? cloudinaryOptimizedUrl(imgRaw, { w: 320, h: 320 }) : "";
  const isService = String(product.listingType || "product") === "service";
  const boosted = Number(product.boostUntilMs || 0) > Date.now();
  const stock = Number(product.stock ?? 0);
  const marketEnabled = product.marketEnabled !== false;

  return (
    <Card className="overflow-hidden relative">
      <div className="aspect-square bg-gray-100 relative">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.name || "Product"} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-300" />
          </div>
        )}

        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {boosted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-bold">
              <Sparkles className="w-3 h-3" />
              Promoted
            </span>
          )}
          {!marketEnabled && <span className="px-2 py-0.5 rounded-full bg-gray-800/70 text-white text-[10px] font-bold">Hidden</span>}
        </div>

        {!isService && (
          <div className="absolute bottom-2 right-2">
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", stock === 0 ? "bg-red-500 text-white" : stock <= 5 ? "bg-orange-500 text-white" : "bg-black/50 text-white")}>
              {stock === 0 ? "Out of stock" : `${stock} left`}
            </span>
          </div>
        )}

        <button onClick={onActionMenuToggle} className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center" aria-label="Product actions">
          <MoreVertical className="w-4 h-4 text-gray-700" />
        </button>
      </div>

      <div className="p-3">
        <p className="font-bold text-gray-900 text-sm truncate">{product.name || "Unnamed"}</p>
        <p className="text-sm text-orange-600 font-bold mt-1">{isService ? "Service" : fmtNaira(product.price || 0)}</p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit} disabled={!canManage}>Edit</Button>
          <Button size="sm" variant="secondary" onClick={onShare}>Share</Button>
        </div>
      </div>

      {actionMenuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onActionMenuToggle} />
          <div className="absolute right-3 top-[3.25rem] z-20 w-52 rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
            <button onClick={onCopyLink} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition">
              <Copy className="w-4 h-4 text-gray-400" />
              Copy link
            </button>

            {canManage ? (
              <button onClick={onDelete} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-700 hover:bg-red-50 transition border-t border-gray-100">
                <Trash2 className="w-4 h-4 text-red-500" />
                Delete product
              </button>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}
