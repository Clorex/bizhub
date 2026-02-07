// FILE: src/app/vendor/products/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { OptionGroup, VariationBuilder } from "@/components/vendor/VariationBuilder";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
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

  // ✅ stored, but UI is only inside cropper
  const [coverAspect, setCoverAspect] = useState<CoverAspectKey>("1:1");

  // ✅ categories + attrs
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
      if (!token) throw new Error("Not logged in");

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
          coverAspect, // ✅ saved, but selected inside crop UI

          categoryKeys: categoryKeys.slice(0, 3),
          colorsCsv,
          sizesCsv,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (data?.code === "PLAN_LIMIT_PRODUCTS") {
          setLocked(true);
          throw new Error(data?.error || "Limit reached. Upgrade to add more.");
        }
        throw new Error(data?.error || "Create failed");
      }

      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}

      router.push(`/vendor/products/${data.productId}/edit`);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="New product" showBack={true} subtitle="Add a product" />

      <div className="px-4 pb-24 space-y-3">
        {msg ? (
          <Card className={locked ? "p-4 text-orange-700" : "p-4 text-red-700"}>
            <p className="font-bold text-biz-ink">{locked ? "Upgrade required" : "Error"}</p>
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
          <input
            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
            placeholder="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <textarea
            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-biz-muted">₦</span>
            <input
              className="w-full border border-biz-line rounded-2xl p-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
              placeholder="Price"
              inputMode="numeric"
              value={priceText}
              onChange={(e) => setPriceText(formatNumberText(e.target.value))}
            />
          </div>

          <input
            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
            placeholder="Stock"
            inputMode="numeric"
            value={stockText}
            onChange={(e) => setStockText(formatNumberText(e.target.value))}
          />

          <div className="mt-2">
            <p className="text-sm font-bold text-biz-ink">Packaging</p>

            <select
              className="mt-2 w-full border border-biz-line rounded-2xl p-3 text-sm bg-white"
              value={packagingChoice}
              onChange={(e) => setPackagingChoice(e.target.value)}
            >
              {PACKAGING.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {packagingChoice === "Other" ? (
              <input
                className="mt-2 w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                placeholder="Type packaging"
                value={packagingOther}
                onChange={(e) => setPackagingOther(e.target.value)}
              />
            ) : null}
          </div>

          <p className="text-[11px] text-biz-muted">
            Preview: <b className="text-biz-ink">{fmtNaira(price)}</b> • Stock:{" "}
            <b className="text-biz-ink">{stockText || "—"}</b> • Packaging:{" "}
            <b className="text-biz-ink">{packagingFinal}</b>
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-bold text-biz-ink">Categories (max 3)</p>

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
            <input
              className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
              placeholder="Colors (comma separated) e.g. black, red, white"
              value={colorsCsv}
              onChange={(e) => setColorsCsv(e.target.value)}
            />
            <input
              className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
              placeholder="Sizes (comma separated) e.g. 40, 41, L, XL"
              value={sizesCsv}
              onChange={(e) => setSizesCsv(e.target.value)}
            />
          </div>
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
            allowFreeAspect={false}          // ✅ only 7 aspect ratios
            aspectKey={coverAspect}          // ✅ store chosen ratio
            onAspectKeyChange={setCoverAspect}
          />

          {images.length === 0 ? (
            <p className="mt-2 text-[11px] text-red-700">Add at least 1 product image to continue.</p>
          ) : (
            <p className="mt-2 text-[11px] text-biz-muted">Tip: The first image is your cover photo.</p>
          )}
        </Card>

        <Card className="p-4">
          <VariationBuilder value={optionGroups} onChange={setOptionGroups} maxGroups={10} />
        </Card>

        <Card className="p-4">
          <Button onClick={create} loading={loading} disabled={!canCreate}>
            Create product
          </Button>

          {!priceOk ? <p className="mt-2 text-[11px] text-red-700">Product requires a price greater than 0.</p> : null}
        </Card>
      </div>
    </div>
  );
}