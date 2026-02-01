"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, limit, query, where, orderBy } from "firebase/firestore";
import { track } from "@/lib/track/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Store, Phone, ArrowLeft, Package } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function waLink(wa: string, text: string) {
  const digits = wa.replace(/[^\d]/g, "");
  const t = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${t}`;
}

function Tile({
  title,
  subtitle,
  image,
  badge,
  onClick,
}: {
  title: string;
  subtitle?: string;
  image?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left w-full">
      <Card className="p-3 hover:bg-black/[0.02] transition">
        <div className="h-24 w-full rounded-2xl bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden relative">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={title} className="h-full w-full object-cover" />
          ) : null}

          {badge ? (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-extrabold bg-white/90 border border-black/5">
              {badge}
            </div>
          ) : null}
        </div>

        <p className="mt-2 text-sm font-extrabold text-biz-ink line-clamp-2">{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-biz-muted">{subtitle}</p> : null}
      </Card>
    </button>
  );
}

export default function StorefrontPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? "");

  const [biz, setBiz] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const products = useMemo(
    () => items.filter((x) => String(x.listingType || "product") !== "service"),
    [items]
  );
  const services = useMemo(
    () => items.filter((x) => String(x.listingType || "product") === "service"),
    [items]
  );

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setMsg(null);

        const qBiz = query(collection(db, "businesses"), where("slug", "==", slug), limit(1));
        const snapBiz = await getDocs(qBiz);
        if (snapBiz.empty) throw new Error("Store not found");
        const b = { id: snapBiz.docs[0].id, ...snapBiz.docs[0].data() };

        const qP = query(
          collection(db, "products"),
          where("businessSlug", "==", slug),
          orderBy("createdAt", "desc"),
          limit(200)
        );
        const snapP = await getDocs(qP);
        const list = snapP.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (!mounted) return;
        setBiz(b);
        setItems(list);

        // track store visit
        if (b?.id) track({ type: "store_visit", businessId: b.id, businessSlug: slug });
      } catch (e: any) {
        setMsg(e?.message || "Failed to load store");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (slug) run();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const banner = String(biz?.bannerUrl || "");
  const logo = String(biz?.logoUrl || "");
  const name = String(biz?.name || slug);
  const about = String(biz?.description || "");
  const location = [biz?.city, biz?.state].filter(Boolean).join(", ");
  const whatsapp = String(biz?.whatsapp || "");
  const instagram = String(biz?.instagram || "");

  return (
    <div className="min-h-screen">
      <GradientHeader
        title={name}
        subtitle={location || `Store: ${slug}`}
        showBack={true}
        right={
          <button
            className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-extrabold shadow-soft"
            onClick={() => router.push("/market")}
          >
            Market
          </button>
        }
      />

      <div className="px-4 pb-6 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && biz ? (
          <>
            {/* Store card */}
            <Card className="p-0 overflow-hidden">
              <div className="h-36 w-full bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden">
                {banner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner} alt="Banner" className="h-full w-full object-cover" />
                ) : null}
              </div>

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-biz-cream overflow-hidden border border-biz-line shrink-0">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Store className="h-6 w-6 text-orange-700" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-extrabold text-biz-ink">{name}</p>
                    <p className="text-xs text-biz-muted mt-1">{location || "Nigeria"}</p>
                    {instagram ? (
                      <p className="text-xs text-biz-muted mt-1">@{instagram.replace(/^@/, "")}</p>
                    ) : null}
                  </div>
                </div>

                {about ? (
                  <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{about}</p>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    leftIcon={<Phone className="h-4 w-4" />}
                    onClick={() => {
                      if (!whatsapp) {
                        alert("Vendor WhatsApp not set yet.");
                        return;
                      }
                      window.open(
                        waLink(whatsapp, `Hello ${name}. I came from your BizHub store (${slug}).`),
                        "_blank"
                      );
                    }}
                    disabled={!whatsapp}
                  >
                    WhatsApp
                  </Button>

                  <Button variant="secondary" leftIcon={<Package className="h-4 w-4" />} onClick={() => router.push("/cart")}>
                    Cart
                  </Button>
                </div>
              </div>
            </Card>

            {/* Services */}
            <SectionCard
              title="Services"
              subtitle="Book a service or pay to book (depending on the service)"
            >
              {services.length === 0 ? (
                <div className="text-sm text-biz-muted">No services yet.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {services.map((p: any) => {
                    const img = Array.isArray(p?.images) ? p.images[0] : "";
                    const mode = String(p?.serviceMode || "book");

                    return (
                      <Tile
                        key={p.id}
                        title={p?.name || "Service"}
                        subtitle={mode === "book" ? "Book only" : fmtNaira(p?.price || 0)}
                        image={img}
                        badge="Service"
                        onClick={() => {
                          track({
                            type: "store_product_click",
                            businessId: biz.id,
                            businessSlug: slug,
                            productId: p.id,
                          });
                          router.push(`/b/${slug}/p/${p.id}`);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* Products */}
            <SectionCard title="Products" subtitle="Shop items from this store">
              {products.length === 0 ? (
                <EmptyState
                  title="No products yet"
                  description="This store hasn’t added products yet."
                  ctaLabel="Back to market"
                  onCta={() => router.push("/market")}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {products.map((p: any) => {
                    const img = Array.isArray(p?.images) ? p.images[0] : "";
                    const boosted = Number(p?.boostUntilMs || 0) > Date.now();

                    return (
                      <Tile
                        key={p.id}
                        title={p?.name || "Product"}
                        subtitle={fmtNaira(p?.price || 0)}
                        image={img}
                        badge={boosted ? "Promoted" : undefined}
                        onClick={() => {
                          track({
                            type: "store_product_click",
                            businessId: biz.id,
                            businessSlug: slug,
                            productId: p.id,
                          });
                          router.push(`/b/${slug}/p/${p.id}`);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}