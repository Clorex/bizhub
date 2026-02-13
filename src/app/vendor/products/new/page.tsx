// FILE: src/app/vendor/products/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { OptionGroup, VariationBuilder } from "@/components/vendor/VariationBuilder";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { type CoverAspectKey, normalizeCoverAspect } from "@/lib/products/coverAspect";
import { MARKET_CATEGORIES, suggestCategoriesFromText, type MarketCategoryKey } from "@/lib/search/marketTaxonomy";
import { formatMoneyNGN } from "@/lib/money";

import { Package, AlertCircle, CheckCircle2, Zap, Info, Palette, Ruler } from "lucide-react";

/* ──────────────────────────────── Constants ──────────────────────────────── */

const PACKAGING = ["Box", "Nylon", "Bottle", "Plate", "Wrap", "Carton", "Sachet", "Bag", "Other"] as const;
const MAX_IMAGES = 10;
const DRAFT_KEY = "bizhub_vendor_new_product_draft_v1";

/* ──────────────────────────────── Helpers ──────────────────────────────── */

function digitsOnly(s: string) {
  return String(s || "").replace(/[^\d]/g, "");
}

function formatNumberText(s: string) {
  const d = digitsOnly(s);
  if (!d) return "";
  return Number(d).toLocaleString("en-NG");
}

function parseNumberText(s: string) {
  const d = digitsOnly(s);
  return d ? Number(d) : 0;
}

function fmtNaira(n: number) {
  return formatMoneyNGN(Number(n || 0));
}

function uniq<T>(arr: T[]) {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const k = String(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/* ──────────────────────────────── Completion Tracker ──────────────────────────────── */

function useCompletionSteps(
  name: string,
  price: number,
  images: string[],
  description: string,
  categoryKeys: MarketCategoryKey[]
) {
  return useMemo(() => {
    const steps = [
      { label: "Product name", done: !!name.trim(), required: true },
      { label: "Price", done: price > 0, required: true },
      { label: "At least 1 image", done: images.length > 0, required: true },
      { label: "Description", done: !!description.trim(), required: false },
      { label: "Category", done: categoryKeys.length > 0, required: false },
    ];

    const requiredDone = steps.filter((s) => s.required && s.done).length;
    const requiredTotal = steps.filter((s) => s.required).length;
    const allDone = steps.filter((s) => s.done).length;
    const canCreate = requiredDone === requiredTotal;
    const percent = Math.round((allDone / steps.length) * 100);

    return { steps, canCreate, percent };
  }, [name, price, images, description, categoryKeys]);
}

/* ──────────────────────────────── Main Component ──────────────────────────────── */

export default function VendorNewProductPage() {
  const router = useRouter();

  // Form state
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
  const [categoriesTouched, setCategoriesTouched] = useState(false);
  const [colorsCsv, setColorsCsv] = useState("");
  const [sizesCsv, setSizesCsv] = useState("");

  // UI state
  const [msg, setMsg] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Derived
  const price = useMemo(() => parseNumberText(priceText), [priceText]);
  const stock = useMemo(() => parseNumberText(stockText), [stockText]);
  const { steps, canCreate, percent } = useCompletionSteps(name, price, images, description, categoryKeys);

  const packagingFinal = useMemo(() => {
    if (packagingChoice === "Other") return packagingOther.trim() || "Other";
    return packagingChoice;
  }, [packagingChoice, packagingOther]);

  function resetForm() {
    setName("");
    setDescription("");
    setPriceText("");
    setStockText("");
    setPackagingChoice("Box");
    setPackagingOther("");
    setImages([]);
    setOptionGroups([]);
    setCoverAspect("1:1");
    setCategoryKeys([]);
    setCategoriesTouched(false);
    setColorsCsv("");
    setSizesCsv("");
    setMsg(null);
    setLocked(false);
  }

  /* Draft restore */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);

      if (typeof d?.name === "string") setName(d.name);
      if (typeof d?.description === "string") setDescription(d.description);
      if (typeof d?.priceText === "string") setPriceText(d.priceText);
      if (typeof d?.stockText === "string") setStockText(d.stockText);
      if (typeof d?.packagingChoice === "string") setPackagingChoice(d.packagingChoice);
      if (typeof d?.packagingOther === "string") setPackagingOther(d.packagingOther);
      if (Array.isArray(d?.images)) setImages(d.images.slice(0, MAX_IMAGES));
      if (Array.isArray(d?.optionGroups)) setOptionGroups(d.optionGroups);
      const ca = normalizeCoverAspect(d?.coverAspect);
      if (ca) setCoverAspect(ca);
      if (Array.isArray(d?.categoryKeys)) setCategoryKeys(d.categoryKeys.slice(0, 3));
      if (typeof d?.categoriesTouched === "boolean") setCategoriesTouched(d.categoriesTouched);
      if (typeof d?.colorsCsv === "string") setColorsCsv(d.colorsCsv);
      if (typeof d?.sizesCsv === "string") setSizesCsv(d.sizesCsv);
    } catch {}
  }, []);

  /* Draft save */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            name,
            description,
            priceText,
            stockText,
            packagingChoice,
            packagingOther,
            images: images.slice(0, MAX_IMAGES),
            optionGroups,
            coverAspect,
            categoryKeys: categoryKeys.slice(0, 3),
            categoriesTouched,
            colorsCsv,
            sizesCsv,
            ts: Date.now(),
          })
        );
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [
    name,
    description,
    priceText,
    stockText,
    packagingChoice,
    packagingOther,
    images,
    optionGroups,
    coverAspect,
    categoryKeys,
    categoriesTouched,
    colorsCsv,
    sizesCsv,
  ]);

  /* Auto-suggest categories */
  useEffect(() => {
    if (categoriesTouched) return;
    const text = `${name} ${description}`.trim();
    if (!text) return;
    const current = Array.isArray(categoryKeys) ? categoryKeys : [];
    const isEmpty = current.length === 0 || (current.length === 1 && current[0] === "other");
    if (!isEmpty) return;
    setCategoryKeys(suggestCategoriesFromText(text, 3));
  }, [name, description, categoriesTouched, categoryKeys]);

  function toggleCategory(k: MarketCategoryKey) {
    setCategoriesTouched(true);
    setCategoryKeys((prev) => {
      const cur = uniq(prev).slice(0, 3);
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      if (cur.length >= 3) {
        toast.info("Maximum 3 categories allowed.");
        return cur;
      }
      return [...cur, k].slice(0, 3);
    });
  }

  async function create() {
    setLoading(true);
    setMsg(null);
    setLocked(false);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const r = await fetch("/api/vendor/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price,
          stock,
          packaging: packagingFinal,
          images: images.slice(0, MAX_IMAGES),
          optionGroups,
          variants: [],
          coverAspect,
          categoryKeys: categoryKeys.slice(0, 3),
          colorsCsv,
          sizesCsv,
        }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        if (data?.code === "PLAN_LIMIT_PRODUCTS") {
          setLocked(true);
          throw new Error(data?.error || "Product limit reached. Upgrade to add more.");
        }
        throw new Error(data?.error || "Could not create product.");
      }

      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}

      // B10-3: stay on Add Product, reset form, toast
      toast.success("Product added successfully");
      resetForm();

      // Do NOT route to edit/quick-actions screen
      // router.push(`/vendor/products/${data.productId}/edit`);
    } catch (e: any) {
      const m = e?.message || "Could not create product.";
      setMsg(m);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <GradientHeader title="New Product" subtitle="Add to your catalog" showBack={true} />

      <div className="px-4 space-y-4 pt-4">
        {/* Completion Progress */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Completion</p>
            <span
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                percent === 100 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
              )}
            >
              {percent}%
            </span>
          </div>

          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                percent === 100 ? "bg-green-500" : "bg-orange-500"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-3 space-y-1.5">
            {steps.map((step) => (
              <div key={step.label} className="flex items-center gap-2">
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 shrink-0",
                      step.required ? "border-orange-300" : "border-gray-300"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "text-xs",
                    step.done ? "text-gray-500 line-through" : step.required ? "text-gray-700" : "text-gray-400"
                  )}
                >
                  {step.label}
                  {step.required && !step.done && <span className="text-orange-500"> *</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Error / Upgrade Message */}
        {msg && (
          <Card className={cn("p-4", locked ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200")}>
            <div className="flex items-start gap-3">
              <AlertCircle className={cn("w-5 h-5 shrink-0 mt-0.5", locked ? "text-orange-600" : "text-red-600")} />
              <div className="flex-1">
                <p className={cn("text-sm font-medium", locked ? "text-orange-800" : "text-red-800")}>
                  {locked ? "Product limit reached" : "Something went wrong"}
                </p>
                <p className={cn("text-xs mt-1", locked ? "text-orange-600" : "text-red-600")}>{msg}</p>
                {locked && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => router.push("/vendor/subscription")}
                      leftIcon={<Zap className="w-4 h-4" />}
                    >
                      Upgrade
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => router.push("/vendor/products")}>
                      Back
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Images first */}
        <SectionCard title="Product Images" subtitle={`${images.length}/${MAX_IMAGES} uploaded`}>
          <ImageUploader
            label="Product images"
            value={images}
            onChange={(next) => setImages(next)}
            max={MAX_IMAGES}
            folderBase="bizhub/uploads/products"
            disabled={loading}
            autoOpenCrop={true}
            allowFreeAspect={false}
            aspectKey={coverAspect}
            onAspectKeyChange={setCoverAspect}
          />

          {images.length === 0 ? (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Add at least 1 image to create your product.
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">The first image will be your cover photo.</p>
          )}
        </SectionCard>

        {/* Product Name & Description */}
        <SectionCard title="Basic Information" subtitle="Name and description">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Product Name <span className="text-orange-500">*</span>
              </label>
              <Input
                placeholder="e.g. Nike Air Max 90"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 resize-none disabled:opacity-50"
                placeholder="Describe your product — material, features, what makes it special..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={4}
                maxLength={2000}
              />
              <p className="text-[11px] text-gray-400 mt-1">{description.length}/2000</p>
            </div>
          </div>
        </SectionCard>

        {/* Price & Stock */}
        <SectionCard title="Pricing & Inventory" subtitle="Set your price and stock">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Price <span className="text-orange-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none">
                  ₦
                </span>
                <input
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 disabled:opacity-50"
                  placeholder="0"
                  inputMode="numeric"
                  value={priceText}
                  onChange={(e) => setPriceText(formatNumberText(e.target.value))}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Stock Quantity</label>
              <Input
                placeholder="Leave empty for unlimited"
                inputMode="numeric"
                value={stockText}
                onChange={(e) => setStockText(formatNumberText(e.target.value))}
                disabled={loading}
              />
            </div>

            {/* B9-2: Custom select (no native <select>) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Packaging</label>
              <SelectMenu
                title="Packaging"
                value={packagingChoice}
                onChange={(v) => setPackagingChoice(v)}
                disabled={loading}
                options={PACKAGING.map((p) => ({ value: p, label: p }))}
              />

              {packagingChoice === "Other" && (
                <Input
                  className="mt-2"
                  placeholder="Specify packaging type"
                  value={packagingOther}
                  onChange={(e) => setPackagingOther(e.target.value)}
                  disabled={loading}
                />
              )}
            </div>

            {(price > 0 || stockText) && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="text-sm font-semibold text-gray-900">{fmtNaira(price)}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Stock</p>
                  <p className="text-sm font-semibold text-gray-900">{stockText || "Unlimited"}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Packaging</p>
                  <p className="text-sm font-semibold text-gray-900">{packagingFinal}</p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Categories */}
        <SectionCard title="Categories" subtitle="Help buyers discover your product (max 3)">
          <div className="flex flex-wrap gap-2">
            {MARKET_CATEGORIES.map((c) => (
              <Chip key={c.key} active={categoryKeys.includes(c.key)} onClick={() => toggleCategory(c.key)}>
                {c.label}
              </Chip>
            ))}
          </div>

          {/* B10-1: Color + Size side-by-side on typical mobile widths, wrap gracefully */}
          <div className="mt-4 grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-gray-400" />
                  Colors
                </span>
              </label>
              <Input
                placeholder="e.g. Black"
                value={colorsCsv}
                onChange={(e) => setColorsCsv(e.target.value)}
                disabled={loading}
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
                placeholder="e.g. M, L, XL"
                value={sizesCsv}
                onChange={(e) => setSizesCsv(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Colors and sizes help buyers filter search results. They don't affect stock or pricing.
            </p>
          </div>
        </SectionCard>

        {/* Variations */}
        <SectionCard title="Variations" subtitle="Optional: size, color, flavor options">
          <VariationBuilder value={optionGroups} onChange={setOptionGroups} maxGroups={10} />
        </SectionCard>

        {/* Create Button */}
        <div className="pt-2 space-y-3">
          <Button
            onClick={create}
            loading={loading}
            disabled={!canCreate || loading}
            className="w-full"
            leftIcon={<Package className="w-5 h-5" />}
          >
            Create Product
          </Button>

          {!canCreate && name.trim() && (
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
              <p className="text-xs text-orange-700">
                {price <= 0 && "Set a price greater than ₦0. "}
                {images.length === 0 && "Upload at least 1 product image."}
              </p>
            </div>
          )}

          {!name.trim() && (
            <p className="text-xs text-gray-400 text-center">Enter a product name, price, and image to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}