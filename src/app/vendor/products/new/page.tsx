"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { OptionGroup, VariationBuilder } from "@/components/vendor/VariationBuilder";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { toast } from "@/lib/ui/toast";
import { type CoverAspectKey, normalizeCoverAspect } from "@/lib/products/coverAspect";
import { MARKET_CATEGORIES, suggestCategoriesFromText, type MarketCategoryKey } from "@/lib/search/marketTaxonomy";

const PACKAGING = ["Box", "Nylon", "Bottle", "Plate", "Wrap", "Carton", "Sachet", "Bag", "Other"] as const;
const MAX_IMAGES = 10;
const DRAFT_KEY = "bizhub_vendor_new_product_draft_v1";

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
  try {
    return `₦${Number(n || 0).toLocaleString("en-NG")}`;
  } catch {
    return `₦${n}`;
  }
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

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  return m.length > 140 ? fallback : m;
}

export default function VendorNewProductPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [priceText, setPriceText] = useState<string>("");
  const [stockText, setStockText] = useState<string>("");

  const [packagingChoice, setPackagingChoice] = useState<string>("Box");
  const [packagingOther, setPackagingOther] = useState<string>("");

  const [images, setImages] = useState<string[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

  const [coverAspect, setCoverAspect] = useState<CoverAspectKey>("1:1");

  const [categoryKeys, setCategoryKeys] = useState<MarketCategoryKey[]>([]);
  const [categoriesTouched, setCategoriesTouched] = useState(false);
  const [catMsg, setCatMsg] = useState<string | null>(null);
  const [colorsCsv, setColorsCsv] = useState("");
  const [sizesCsv, setSizesCsv] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const price = useMemo(() => parseNumberText(priceText), [priceText]);
  const stock = useMemo(() => parseNumberText(stockText), [stockText]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw || "{}");

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
    }, 250);

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

  // auto-suggest categories (if not touched)
  useEffect(() => {
    if (categoriesTouched) return;
    const text = `${name} ${description}`.trim();
    if (!text) return;

    const current = Array.isArray(categoryKeys) ? categoryKeys : [];
    const isEmptyOrOtherOnly = current.length === 0 || (current.length === 1 && String(current[0]) === "other");
    if (!isEmptyOrOtherOnly) return;

    setCategoryKeys(suggestCategoriesFromText(text, 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, categoriesTouched]);

  const packagingFinal = useMemo(() => {
    if (packagingChoice === "Other") return packagingOther.trim() || "Other";
    return packagingChoice;
  }, [packagingChoice, packagingOther]);

  const priceOk = useMemo(() => {
    if (!name.trim()) return false;
    return price > 0;
  }, [price, name]);

  const imagesOk = useMemo(() => images.length > 0, [images.length]);
  const canCreate = priceOk && imagesOk && !loading;

  function toggleCategory(k: MarketCategoryKey) {
    setCatMsg(null);
    setCategoriesTouched(true);

    setCategoryKeys((prev) => {
      const cur = uniq((prev || []) as MarketCategoryKey[]).slice(0, 3);
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      if (cur.length >= 3) {
        setCatMsg("You can select up to 3 categories.");
        toast.info("You can select up to 3 categories.");
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
      if (!token) throw new Error("Please log in again to continue.");

      const r = await fetch("/api/vendor/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price: Number(price || 0),
          stock: Number(stock || 0),
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
          throw new Error(data?.error || "You've reached your product limit. Upgrade to add more.");
        }
        throw new Error(data?.error || "Could not create product. Please try again.");
      }

      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}

      toast.success("Product created.");
      router.push(`/vendor/products/${data.productId}/edit`);
    } catch (e: any) {
      const m = niceError(e, "Could not create product. Please try again.");
      setMsg(m);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="New product" showBack={true} subtitle="Add a product to your store" />

      <div className="px-4 pb-24 space-y-3">
        {msg ? (
          <Card className={locked ? "p-4 text-orange-700" : "p-4 text-red-700"}>
            <p className="font-bold text-biz-ink">{locked ? "Upgrade required" : "Issue"}</p>
            <p className="text-sm mt-2">{msg}</p>

            {locked ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => router.push("/vendor/subscription")}>Upgrade</Button>
                <Button variant="secondary" onClick={() => router.push("/vendor/products")}>
                  Back
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card className="p-4 space-y-2">
          <Input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />

          <textarea
            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40 disabled:opacity-50"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            rows={4}
          />

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-biz-muted pointer-events-none">
              ₦
            </span>
            <input
              className="w-full border border-biz-line rounded-2xl p-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40 disabled:opacity-50"
              placeholder="Price"
              inputMode="numeric"
              value={priceText}
              onChange={(e) => setPriceText(formatNumberText(e.target.value))}
              disabled={loading}
            />
          </div>

          <Input
            placeholder="Stock (optional)"
            inputMode="numeric"
            value={stockText}
            onChange={(e) => setStockText(formatNumberText(e.target.value))}
            disabled={loading}
          />

          <div className="mt-2">
            <p className="text-sm font-bold text-biz-ink">Packaging</p>

            <select
              className="mt-2 w-full border border-biz-line rounded-2xl p-3 text-sm bg-white disabled:opacity-50"
              value={packagingChoice}
              onChange={(e) => setPackagingChoice(e.target.value)}
              disabled={loading}
            >
              {PACKAGING.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {packagingChoice === "Other" ? (
              <Input
                className="mt-2"
                placeholder="Specify packaging"
                value={packagingOther}
                onChange={(e) => setPackagingOther(e.target.value)}
                disabled={loading}
              />
            ) : null}
          </div>

          <p className="text-[11px] text-biz-muted">
            Preview: <b className="text-biz-ink">{fmtNaira(price)}</b> • Stock: <b className="text-biz-ink">{stockText || "—"}</b> •
            Packaging: <b className="text-biz-ink">{packagingFinal}</b>
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-bold text-biz-ink">Categories (max 3)</p>
          <p className="text-[11px] text-biz-muted mt-1">Help buyers find your product</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {MARKET_CATEGORIES.map((c) => {
              const active = categoryKeys.includes(c.key);
              return (
                <Chip key={c.key} active={active} onClick={() => toggleCategory(c.key)}>
                  {c.label}
                </Chip>
              );
            })}
          </div>

          {catMsg ? <p className="mt-2 text-[11px] text-red-700">{catMsg}</p> : null}

          <div className="mt-4 grid grid-cols-1 gap-2">
            <Input
              placeholder="Colors (comma separated) e.g. black, red, white"
              value={colorsCsv}
              onChange={(e) => setColorsCsv(e.target.value)}
              disabled={loading}
            />
            <Input
              placeholder="Sizes (comma separated) e.g. 40, 41, L, XL"
              value={sizesCsv}
              onChange={(e) => setSizesCsv(e.target.value)}
              disabled={loading}
            />
          </div>

          <p className="mt-2 text-[11px] text-biz-muted">
            Colors and sizes help buyers filter search results. They don't affect stock or pricing.
          </p>
        </Card>

        <Card className="p-4">
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
            <p className="mt-2 text-[11px] text-red-700">Add at least 1 image to continue.</p>
          ) : (
            <p className="mt-2 text-[11px] text-biz-muted">The first image is your cover photo.</p>
          )}
        </Card>

        <Card className="p-4">
          <VariationBuilder value={optionGroups} onChange={setOptionGroups} maxGroups={10} />
        </Card>

        <Card className="p-4">
          <Button onClick={create} loading={loading} disabled={!canCreate}>
            Create product
          </Button>

          {!priceOk && name.trim() ? (
            <p className="mt-2 text-[11px] text-red-700">Price must be greater than ₦0.</p>
          ) : !name.trim() ? (
            <p className="mt-2 text-[11px] text-biz-muted">Enter a product name and price to continue.</p>
          ) : !imagesOk ? (
            <p className="mt-2 text-[11px] text-red-700">Add at least 1 image to continue.</p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}