// FILE: src/app/vendor/products/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { OptionGroup, VariationBuilder } from "@/components/vendor/VariationBuilder";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const PACKAGING = ["Box", "Nylon", "Bottle", "Plate", "Wrap", "Carton", "Sachet", "Bag", "Other"];

type ListingType = "product" | "service";
type ServiceMode = "book" | "pay";

export default function VendorNewProductPage() {
  const router = useRouter();

  const [listingType, setListingType] = useState<ListingType>("product");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("book");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [price, setPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);

  const [packaging, setPackaging] = useState<string>("Box");
  const [images, setImages] = useState<string[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

  const [msg, setMsg] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const isService = listingType === "service";

  const priceOk = useMemo(() => {
    if (!name.trim()) return false;
    if (listingType === "product") return price > 0;
    if (serviceMode === "pay") return price > 0;
    return price >= 0; // book-only service can be 0
  }, [listingType, serviceMode, price, name]);

  async function create() {
    setLoading(true);
    setMsg(null);
    setLocked(false);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const r = await fetch("/api/vendor/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingType,
          serviceMode: listingType === "service" ? serviceMode : undefined,

          name,
          description,
          price: Number(price || 0),
          stock: listingType === "product" ? Number(stock || 0) : 0,

          packaging,
          images,
          optionGroups,
          variants: [],
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

      router.push(`/vendor/products/${data.productId}/edit`);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="New listing" showBack={true} subtitle="Add a product or service" />

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

        <Card className="p-4">
          <p className="text-sm font-bold text-biz-ink">Listing type</p>
          <p className="text-xs text-biz-muted mt-1">Choose what you’re creating.</p>

          <div className="mt-3">
            <SegmentedControl<ListingType>
              value={listingType}
              onChange={(v) => {
                setListingType(v);
                if (v === "service") setServiceMode("book");
              }}
              options={[
                { value: "product", label: "Product" },
                { value: "service", label: "Service" },
              ]}
            />
          </div>

          {listingType === "service" ? (
            <div className="mt-3">
              <p className="text-sm font-bold text-biz-ink">Service mode</p>
              <div className="mt-2">
                <SegmentedControl<ServiceMode>
                  value={serviceMode}
                  onChange={setServiceMode}
                  options={[
                    { value: "book", label: "Book only" },
                    { value: "pay", label: "Pay to book" },
                  ]}
                />
              </div>
              <p className="mt-2 text-[11px] text-biz-muted">
                Book only → customers contact you via WhatsApp. Pay to book → customers pay at checkout.
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="p-4 space-y-2">
          <input
            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
            placeholder={isService ? "Service name" : "Product name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <textarea
            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
            placeholder={isService ? "Describe your service…" : "Description"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />

          <input
            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
            placeholder={listingType === "service" && serviceMode === "book" ? "Price (optional)" : "Price (NGN)"}
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />

          {listingType === "product" ? (
            <input
              className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
              placeholder="Stock"
              type="number"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
            />
          ) : (
            <div className="rounded-2xl border border-biz-line bg-white p-3">
              <p className="text-xs text-biz-muted">Stock is not required for services.</p>
            </div>
          )}

          <div className="mt-2">
            <p className="text-sm font-bold text-biz-ink">{isService ? "Category" : "Packaging"}</p>
            <select
              className="mt-2 w-full border border-biz-line rounded-2xl p-3 text-sm bg-white"
              value={packaging}
              onChange={(e) => setPackaging(e.target.value)}
            >
              {PACKAGING.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {packaging === "Other" ? (
              <input
                className="mt-2 w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                placeholder={isService ? "Type category (e.g. Lash, Nails)" : "Type packaging"}
                onChange={(e) => setPackaging(e.target.value)}
              />
            ) : null}
          </div>
        </Card>

        <Card className="p-4">
          <ImageUploader
            label={isService ? "Service images (optional)" : "Product images"}
            multiple={true}
            onUploaded={(urls) => setImages((prev) => [...prev, ...urls])}
          />
        </Card>

        <Card className="p-4">
          <VariationBuilder value={optionGroups} onChange={setOptionGroups} maxGroups={10} />
        </Card>

        <Card className="p-4">
          <Button onClick={create} loading={loading} disabled={!priceOk || loading}>
            Create {isService ? "Service" : "Product"}
          </Button>

          {!priceOk ? (
            <p className="mt-2 text-[11px] text-red-700">
              {listingType === "product"
                ? "Product requires a price greater than 0."
                : serviceMode === "pay"
                  ? "Pay-to-book service requires a price greater than 0."
                  : "Enter a name to continue."}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}