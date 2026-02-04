"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { OptionGroup, VariationBuilder } from "@/components/vendor/VariationBuilder";
import { Button } from "@/components/ui/Button";
import { Megaphone } from "lucide-react";

const PACKAGING = ["Box", "Nylon", "Bottle", "Plate", "Wrap", "Carton", "Sachet", "Bag", "Other"] as const;
const MAX_IMAGES = 10;

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

export default function VendorEditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = String((params as any)?.productId ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [priceText, setPriceText] = useState<string>("");
  const [stockText, setStockText] = useState<string>("");

  const [packagingChoice, setPackagingChoice] = useState<string>("Box");
  const [packagingOther, setPackagingOther] = useState<string>("");

  const [images, setImages] = useState<string[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [marketEnabled, setMarketEnabled] = useState(true);

  const price = useMemo(() => parseNumberText(priceText), [priceText]);
  const stock = useMemo(() => parseNumberText(stockText), [stockText]);

  const packagingFinal = useMemo(() => {
    if (packagingChoice === "Other") return packagingOther.trim() || "Other";
    return packagingChoice;
  }, [packagingChoice, packagingOther]);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    return price > 0 && !saving;
  }, [name, price, saving]);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setMsg(null);

        const data = await authedFetch(`/api/vendor/products/${productId}`);
        const p = data?.product;

        if (!mounted) return;

        setName(String(p?.name || ""));
        setDescription(String(p?.description || ""));

        const loadedPrice = Number(p?.price || 0);
        setPriceText(loadedPrice > 0 ? loadedPrice.toLocaleString("en-NG") : "");

        const loadedStock = Number(p?.stock ?? 0);
        setStockText(loadedStock >= 0 ? loadedStock.toLocaleString("en-NG") : "");

        const savedPackaging = String(p?.packaging || "Box");
        if ((PACKAGING as readonly string[]).includes(savedPackaging)) {
          setPackagingChoice(savedPackaging);
          setPackagingOther("");
        } else {
          setPackagingChoice("Other");
          setPackagingOther(savedPackaging);
        }

        setImages(Array.isArray(p?.images) ? p.images.slice(0, MAX_IMAGES) : []);
        setOptionGroups(Array.isArray(p?.optionGroups) ? p.optionGroups : []);
        setMarketEnabled(p?.marketEnabled !== false);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load product");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (productId) load();
    return () => {
      mounted = false;
    };
  }, [productId]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await authedFetch(`/api/vendor/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // ✅ services removed: product-only payload
          name,
          description,
          price,
          stock,
          packaging: packagingFinal,
          images: images.slice(0, MAX_IMAGES),
          optionGroups,
          marketEnabled,
        }),
      });

      setMsg("Saved successfully.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    const ok = confirm("Delete this product? This cannot be undone.");
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      await authedFetch(`/api/vendor/products/${productId}`, { method: "DELETE" });
      router.push("/vendor/products");
    } catch (e: any) {
      setMsg(e?.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Edit product" showBack={true} subtitle={productId ? `#${productId.slice(0, 8)}` : undefined} />

      <div className="px-4 pb-6 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className={msg.includes("Saved") ? "p-4 text-green-700" : "p-4 text-red-700"}>{msg}</Card> : null}

        {!loading ? (
          <>
            <Card className="p-4 space-y-3">
              <div className="space-y-2">
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

                <div className="mt-2 rounded-2xl border border-biz-line p-3 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-biz-ink">Marketplace</p>
                      <p className="text-xs text-biz-muted mt-1">If OFF, this product will not appear on /market search.</p>
                    </div>

                    <button
                      className={
                        marketEnabled
                          ? "px-3 py-2 rounded-2xl text-xs font-bold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent"
                          : "px-3 py-2 rounded-2xl text-xs font-bold border border-biz-line bg-white"
                      }
                      onClick={() => setMarketEnabled((v) => !v)}
                    >
                      {marketEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-biz-muted">
                  Preview: <b className="text-biz-ink">{fmtNaira(price)}</b> • Stock:{" "}
                  <b className="text-biz-ink">{stockText || "—"}</b> • Packaging:{" "}
                  <b className="text-biz-ink">{packagingFinal}</b>
                </p>
              </div>
            </Card>

            <Card className="p-4">
              <ImageUploader
                label="Product images"
                value={images}
                onChange={setImages}
                max={MAX_IMAGES}
                folderBase="bizhub/uploads/products"
                disabled={saving}
              />
              <p className="mt-2 text-[11px] text-biz-muted">Tip: The first image is your cover photo.</p>
            </Card>

            <Card className="p-4">
              <VariationBuilder value={optionGroups} onChange={setOptionGroups} maxGroups={10} />
            </Card>

            <Card className="p-4 space-y-2">
              <Button
                onClick={() => router.push(`/vendor/promote?productId=${encodeURIComponent(productId)}`)}
                leftIcon={<Megaphone className="h-4 w-4" />}
              >
                Promote this product
              </Button>

              <Button onClick={save} disabled={!canSave} loading={saving}>
                Save changes
              </Button>

              <Button variant="danger" onClick={del} disabled={saving}>
                Delete product
              </Button>

              {!canSave ? <p className="text-[11px] text-red-700">Product requires a price greater than 0.</p> : null}
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}