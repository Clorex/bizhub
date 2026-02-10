// FILE: src/app/vendor/products/[productId]/edit/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { OptionGroup, VariationBuilder } from "@/components/vendor/VariationBuilder";
import { MenuCard } from "@/components/vendor/MenuCard";
import { FormSkeleton } from "@/components/vendor/PageSkeleton";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { type CoverAspectKey, normalizeCoverAspect } from "@/lib/products/coverAspect";
import { MARKET_CATEGORIES, type MarketCategoryKey } from "@/lib/search/marketTaxonomy";

import {
  RefreshCw,
  Trash2,
  Eye,
  Share2,
  Copy,
  Save,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  ToggleLeft,
  ToggleRight,
  Palette,
  Ruler,
  Info,
  Package,
} from "lucide-react";

/* ─────────────────────── Constants ─────────────────────── */

const PACKAGING = ["Box", "Nylon", "Bottle", "Plate", "Wrap", "Carton", "Sachet", "Bag", "Other"] as const;
const MAX_IMAGES = 10;

/* ─────────────────────── Helpers ─────────────────────── */

function digitsOnly(s: string) { return String(s || "").replace(/[^\d]/g, ""); }
function formatNumberText(s: string) { const d = digitsOnly(s); if (!d) return ""; return Number(d).toLocaleString("en-NG"); }
function parseNumberText(s: string) { const d = digitsOnly(s); return d ? Number(d) : 0; }
function fmtNaira(n: number) { try { return `₦${Number(n || 0).toLocaleString("en-NG")}`; } catch { return `₦${n}`; } }
function uniq<T>(arr: T[]) { const out: T[] = []; const seen = new Set<string>(); for (const x of arr) { const k = String(x); if (seen.has(k)) continue; seen.add(k); out.push(x); } return out; }

type ListingType = "product" | "service";

/* ─────────────────────── Main Component ─────────────────────── */

export default function VendorEditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = String(params?.productId || "");

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [listingType, setListingType] = useState<ListingType>("product");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [stockText, setStockText] = useState("");
  const [packagingChoice, setPackagingChoice] = useState("Box");
  const [packagingOther, setPackagingOther] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [coverAspect, setCoverAspect] = useState<CoverAspectKey>("1:1");
  const [categoryKeys, setCategoryKeys] = useState<MarketCategoryKey[]>([]);
  const [colorsCsv, setColorsCsv] = useState("");
  const [sizesCsv, setSizesCsv] = useState("");
  const [marketEnabled, setMarketEnabled] = useState(true);
  const [businessSlug, setBusinessSlug] = useState("");

  // Derived
  const price = useMemo(() => parseNumberText(priceText), [priceText]);
  const stock = useMemo(() => parseNumberText(stockText), [stockText]);
  const packagingFinal = useMemo(
    () => packagingChoice === "Other" ? packagingOther.trim() || "Other" : packagingChoice,
    [packagingChoice, packagingOther]
  );

  const productUrl = useMemo(() => {
    if (!businessSlug || !productId || typeof window === "undefined") return "";
    return `${window.location.origin}/b/${businessSlug}/p/${productId}`;
  }, [businessSlug, productId]);

  const priceOk = useMemo(() => {
    if (!name.trim()) return false;
    return listingType === "service" || price > 0;
  }, [name, listingType, price]);
  
  const imagesOk = images.length > 0;
  const canSave = priceOk && imagesOk && !saving && !deleting;

  /* ─── Load Product ─── */
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const [prodRes, meRes] = await Promise.all([
        fetch(`/api/vendor/products/${encodeURIComponent(productId)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [prodData, meData] = await Promise.all([
        prodRes.json().catch(() => ({})),
        meRes.json().catch(() => ({})),
      ]);

      if (!prodRes.ok) throw new Error(prodData?.error || "Could not load product.");
      const p = prodData.product;
      if (!p) throw new Error("Product not found.");

      // Populate form
      setListingType(String(p.listingType || "product") as ListingType);
      setName(String(p.name || ""));
      setDescription(String(p.description || ""));
      setPriceText(formatNumberText(String(Number(p.price || 0))));
      setStockText(formatNumberText(String(Number(p.stock || 0))));

      const pkg = String(p.packaging || "Box");
      if (PACKAGING.includes(pkg as any)) { setPackagingChoice(pkg); setPackagingOther(""); }
      else { setPackagingChoice("Other"); setPackagingOther(pkg); }

      setImages(Array.isArray(p.images) ? p.images.slice(0, MAX_IMAGES) : []);
      setOptionGroups(Array.isArray(p.optionGroups) ? p.optionGroups : []);
      const ca = normalizeCoverAspect(p.coverAspect);
      if (ca) setCoverAspect(ca);
      setCategoryKeys(Array.isArray(p.categoryKeys) ? p.categoryKeys.slice(0, 3) : []);
      setColorsCsv(Array.isArray(p.colors) ? p.colors.join(", ") : String(p.colorsCsv || ""));
      setSizesCsv(Array.isArray(p.sizes) ? p.sizes.join(", ") : String(p.sizesCsv || ""));
      setMarketEnabled(p.marketEnabled !== false);
      setBusinessSlug(String(meData?.me?.businessSlug || ""));

      if (isRefresh) toast.success("Product refreshed!");
    } catch (e: any) {
      setError(e?.message || "Could not load product.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) load();
    else { setError("Invalid product ID"); setLoading(false); }
  }, [productId, load]);

  /* ─── Toggle category ─── */
  function toggleCategory(k: MarketCategoryKey) {
    setCategoryKeys((prev) => {
      const cur = uniq(prev).slice(0, 3);
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      if (cur.length >= 3) { toast.info("Maximum 3 categories."); return cur; }
      return [...cur, k].slice(0, 3);
    });
  }

  /* ─── Save ─── */
  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const r = await fetch(`/api/vendor/products/${encodeURIComponent(productId)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          listingType, name, description, price, stock,
          packaging: packagingFinal,
          images: images.slice(0, MAX_IMAGES), optionGroups, coverAspect,
          categoryKeys: categoryKeys.slice(0, 3), colorsCsv, sizesCsv, marketEnabled,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Could not update product.");

      setSuccess("Product updated successfully!");
      toast.success("Product saved!");
    } catch (e: any) {
      setError(e?.message || "Could not update product.");
      toast.error(e?.message || "Could not update product.");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Delete ─── */
  async function deleteProduct() {
    if (!confirm("Are you sure you want to delete this product? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const r = await fetch(`/api/vendor/products/${encodeURIComponent(productId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Could not delete product.");

      toast.success("Product deleted.");
      router.push("/vendor/products");
    } catch (e: any) {
      setError(e?.message || "Could not delete product.");
      toast.error(e?.message || "Could not delete product.");
    } finally {
      setDeleting(false);
    }
  }

  /* ─── Copy link ─── */
  async function copyLink() {
    if (!productUrl) return;
    try {
      await navigator.clipboard.writeText(productUrl);
      toast.success("Link copied!");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Edit Product" subtitle="Loading..." showBack={true} />
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <GradientHeader
        title="Edit Product"
        subtitle={name || "Update details"}
        showBack={true}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
            >
              <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
            </button>
            {productUrl && (
              <button
                onClick={() => window.open(productUrl, "_blank")}
                className="w-10 h-10 rounded-xl bg-white flex items-center justify-center hover:bg-orange-50 transition"
              >
                <ExternalLink className="w-5 h-5 text-orange-600" />
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 pt-4 space-y-4">
        {/* Success message */}
        {success && (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          </Card>
        )}

        {/* Error message */}
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <SectionCard title="Quick Actions" subtitle="View, share, or copy link">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => productUrl && window.open(productUrl, "_blank")}
              disabled={!productUrl}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition disabled:opacity-50"
            >
              <Eye className="w-5 h-5 text-blue-600 mb-1.5" />
              <span className="text-[11px] font-semibold text-blue-700">Preview</span>
            </button>
            <button
              onClick={copyLink}
              disabled={!productUrl}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 transition disabled:opacity-50"
            >
              <Copy className="w-5 h-5 text-orange-600 mb-1.5" />
              <span className="text-[11px] font-semibold text-orange-700">Copy Link</span>
            </button>
            <button
              onClick={() => {
                if (!productUrl) return;
                window.open(`https://wa.me/?text=${encodeURIComponent(`${name}\n${productUrl}`)}`, "_blank");
              }}
              disabled={!productUrl}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-green-50 hover:bg-green-100 border border-green-200 transition disabled:opacity-50"
            >
              <MessageCircle className="w-5 h-5 text-green-600 mb-1.5" />
              <span className="text-[11px] font-semibold text-green-700">Share</span>
            </button>
          </div>
        </SectionCard>

        {/* Listing Type */}
        <SectionCard title="Listing Type" subtitle="Product or service">
          <SegmentedControl<ListingType>
            value={listingType}
            onChange={setListingType}
            options={[
              { value: "product", label: "Product" },
              { value: "service", label: "Service" },
            ]}
          />
        </SectionCard>

        {/* Basic Info */}
        <SectionCard title="Basic Information" subtitle="Name, price, and stock">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Product Name</label>
              <Input
                placeholder="Product name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving || deleting}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 resize-none disabled:opacity-50"
                placeholder="Describe your product..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving || deleting}
                rows={4}
              />
            </div>

            {listingType === "product" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">₦</span>
                    <input
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 disabled:opacity-50"
                      placeholder="0"
                      inputMode="numeric"
                      value={priceText}
                      onChange={(e) => setPriceText(formatNumberText(e.target.value))}
                      disabled={saving || deleting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Stock</label>
                  <Input
                    placeholder="Leave empty for unlimited"
                    inputMode="numeric"
                    value={stockText}
                    onChange={(e) => setStockText(formatNumberText(e.target.value))}
                    disabled={saving || deleting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Packaging</label>
                  <select
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50 appearance-none"
                    value={packagingChoice}
                    onChange={(e) => setPackagingChoice(e.target.value)}
                    disabled={saving || deleting}
                  >
                    {PACKAGING.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {packagingChoice === "Other" && (
                    <Input
                      className="mt-2"
                      placeholder="Specify packaging type"
                      value={packagingOther}
                      onChange={(e) => setPackagingOther(e.target.value)}
                      disabled={saving || deleting}
                    />
                  )}
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    Price: <span className="font-semibold text-gray-900">{fmtNaira(price)}</span>
                    {" · "}Stock: <span className="font-semibold text-gray-900">{stockText || "Unlimited"}</span>
                  </p>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        {/* Categories */}
        <SectionCard title="Categories" subtitle="Max 3 categories">
          <div className="flex flex-wrap gap-2">
            {MARKET_CATEGORIES.map((c) => (
              <Chip
                key={c.key}
                active={categoryKeys.includes(c.key)}
                onClick={() => toggleCategory(c.key)}
              >
                {c.label}
              </Chip>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-gray-400" />
                  Colors
                </span>
              </label>
              <Input
                placeholder="e.g. black, red, white"
                value={colorsCsv}
                onChange={(e) => setColorsCsv(e.target.value)}
                disabled={saving || deleting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-gray-400" />
                  Sizes
                </span>
              </label>
              <Input
                placeholder="e.g. S, M, L, XL"
                value={sizesCsv}
                onChange={(e) => setSizesCsv(e.target.value)}
                disabled={saving || deleting}
              />
            </div>
          </div>
        </SectionCard>

        {/* Images */}
        <SectionCard title="Product Photos" subtitle={`${images.length}/${MAX_IMAGES} uploaded`}>
          <ImageUploader
            label="Product images"
            value={images}
            onChange={setImages}
            max={MAX_IMAGES}
            folderBase="bizhub/uploads/products"
            disabled={saving || deleting}
            autoOpenCrop={true}
            allowFreeAspect={false}
            aspectKey={coverAspect}
            onAspectKeyChange={setCoverAspect}
          />
          {images.length === 0 && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              At least 1 image is required.
            </p>
          )}
        </SectionCard>

        {/* Variations */}
        {listingType === "product" && (
          <SectionCard title="Variations" subtitle="Size, color, flavor options">
            <VariationBuilder value={optionGroups} onChange={setOptionGroups} maxGroups={10} />
          </SectionCard>
        )}

        {/* Marketplace Visibility */}
        <SectionCard title="Marketplace" subtitle="Control public visibility">
          <button
            type="button"
            className={cn(
              "w-full rounded-2xl border p-4 flex items-center justify-between transition",
              marketEnabled
                ? "bg-green-50 border-green-200 hover:bg-green-100"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            )}
            onClick={() => setMarketEnabled((v) => !v)}
            disabled={saving || deleting}
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Show in Marketplace</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {marketEnabled
                  ? "Visible to all buyers in the marketplace"
                  : "Only accessible via your store link"}
              </p>
            </div>
            {marketEnabled ? (
              <ToggleRight className="w-8 h-8 text-green-600 shrink-0" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-gray-400 shrink-0" />
            )}
          </button>
        </SectionCard>

        {/* Save & Delete */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={save}
            loading={saving}
            disabled={!canSave}
            className="w-full"
            leftIcon={<Save className="w-5 h-5" />}
          >
            Save Changes
          </Button>

          {!canSave && name.trim() && (
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
              <p className="text-xs text-orange-700">
                {!priceOk && "Price must be greater than ₦0. "}
                {!imagesOk && "Upload at least 1 product image."}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3">Danger zone</p>
            <Button
              variant="danger"
              onClick={deleteProduct}
              loading={deleting}
              disabled={saving || deleting}
              className="w-full"
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete Product
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}