// FILE: src/app/vendor/store/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { ImageUploader } from "@/components/vendor/ImageUploader";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";

export default function VendorStoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stateNg, setStateNg] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [continueInChatEnabled, setContinueInChatEnabled] = useState(false);

  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [planKey, setPlanKey] = useState<string>("FREE");
  const [features, setFeatures] = useState<any>(null);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
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

        const [storeData, accessData] = await Promise.all([
          authedFetch("/api/vendor/store"),
          authedFetch("/api/vendor/access"),
        ]);

        const b = storeData?.business;

        if (!mounted) return;

        setName(String(b?.name || ""));
        setDescription(String(b?.description || ""));
        setStateNg(String(b?.state || ""));
        setCity(String(b?.city || ""));
        setWhatsapp(String(b?.whatsapp || ""));
        setInstagram(String(b?.instagram || ""));
        setLogoUrl(String(b?.logoUrl || ""));
        setBannerUrl(String(b?.bannerUrl || ""));

        setContinueInChatEnabled(b?.continueInChatEnabled === true);

        setHasActiveSubscription(!!accessData?.hasActiveSubscription);
        setPlanKey(String(accessData?.planKey || "FREE"));
        setFeatures(accessData?.features || null);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load store settings");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const canEnableChat = useMemo(() => hasActiveSubscription && !!features?.continueInChat, [hasActiveSubscription, features]);
  const canCustomize = useMemo(() => !!features?.storeCustomize, [features]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await authedFetch("/api/vendor/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          state: stateNg,
          city,
          whatsapp,
          instagram,

          // customization will be ignored server-side if plan disallows
          logoUrl,
          bannerUrl,

          continueInChatEnabled,
        }),
      });
      setMsg("Saved successfully.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Store settings" subtitle="Customize your website" showBack={false} />

      <div className="px-4 pb-6 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? (
          <Card className={msg.includes("Saved") ? "p-4 text-green-700" : "p-4 text-red-700"}>
            {msg}
          </Card>
        ) : null}

        {!loading ? (
          <>
            {planKey === "FREE" ? (
              <Card className="p-4">
                <p className="text-sm font-bold text-biz-ink">Free plan</p>
                <p className="text-xs text-biz-muted mt-1">
                  You can use myBizHub’s default store design. Upgrade to unlock full store customization and marketplace visibility.
                </p>
                <div className="mt-3">
                  <Button onClick={() => window.location.href = "/vendor/subscription"}>Upgrade</Button>
                </div>
              </Card>
            ) : null}

            <SectionCard title="Brand" subtitle="What customers see on your storefront">
              <div className="space-y-2">
                <Input placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} />

                <textarea
                  className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                  placeholder="About your business (what you sell / what service you offer)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
            </SectionCard>

            <SectionCard title="Location (Nigeria)" subtitle="Improves trust and discovery">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="State (e.g. Lagos)" value={stateNg} onChange={(e) => setStateNg(e.target.value)} />
                <Input placeholder="City (e.g. Lekki)" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>

              <p className="mt-2 text-xs text-biz-muted">This helps customers know where you operate.</p>
            </SectionCard>

            <SectionCard title="Contact" subtitle="Recommended for services (lash, nails, repairs)">
              <div className="space-y-2">
                <Input
                  placeholder="WhatsApp number (e.g. 2348012345678)"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
                <Input
                  placeholder="Instagram handle (e.g. mybrand)"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>

              <p className="mt-2 text-xs text-biz-muted">Tip: remove “@” — myBizHub will format it automatically.</p>
            </SectionCard>

            <SectionCard title="Checkout & Chat" subtitle="Let customers continue in WhatsApp from cart">
              <div className="rounded-2xl border border-biz-line bg-white p-3">
                <p className="text-sm font-bold text-biz-ink">Continue in Chat</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  When ON, customers can tap “Continue in Chat” from their cart. myBizHub creates an order record and opens WhatsApp with the order details.
                </p>

                {!canEnableChat ? (
                  <p className="mt-2 text-[11px] text-orange-700">
                    Upgrade required: Continue in Chat is not available on your current plan.
                  </p>
                ) : null}

                {!whatsapp.trim() ? (
                  <p className="mt-2 text-[11px] text-orange-700">
                    WhatsApp is not set. Add your WhatsApp number above before turning this ON.
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-biz-muted">
                    Status: <b className="text-biz-ink">{continueInChatEnabled ? "ON" : "OFF"}</b>
                  </span>

                  <button
                    type="button"
                    className={
                      continueInChatEnabled
                        ? "px-3 py-2 rounded-2xl text-xs font-bold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent"
                        : "px-3 py-2 rounded-2xl text-xs font-bold border border-biz-line bg-white"
                    }
                    onClick={() => {
                      if (!canEnableChat && !continueInChatEnabled) {
                        setMsg("Upgrade to enable Continue in Chat.");
                        return;
                      }
                      if (!whatsapp.trim() && !continueInChatEnabled) {
                        setMsg("Add your WhatsApp number before enabling Continue in Chat.");
                        return;
                      }
                      setContinueInChatEnabled((v) => !v);
                    }}
                  >
                    {continueInChatEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              <p className="mt-2 text-[11px] text-biz-muted">
                Note: Checkout remains available.
              </p>
            </SectionCard>

            <SectionCard title="Media" subtitle={canCustomize ? "Logo + banner make your store look premium" : "Upgrade to customize logo and banner"}>
              {!canCustomize ? (
                <div className="rounded-2xl border border-biz-line bg-white p-3">
                  <p className="text-xs text-biz-muted">
                    You’re using myBizHub default design. Upgrade to upload logo and banner.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-sm font-extrabold text-biz-ink">Logo</p>
                    <p className="text-xs text-biz-muted mt-1">Square image recommended.</p>

                    <div className="mt-3">
                      <ImageUploader label="Upload logo" multiple={false} onUploaded={(urls) => setLogoUrl(urls[0] || "")} />
                    </div>

                    {logoUrl ? (
                      <div className="mt-3 h-20 w-20 rounded-2xl overflow-hidden border border-biz-line bg-biz-cream">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-biz-muted">No logo yet.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-sm font-extrabold text-biz-ink">Banner</p>
                    <p className="text-xs text-biz-muted mt-1">Wide image recommended.</p>

                    <div className="mt-3">
                      <ImageUploader label="Upload banner" multiple={false} onUploaded={(urls) => setBannerUrl(urls[0] || "")} />
                    </div>

                    {bannerUrl ? (
                      <div className="mt-3 h-24 w-full rounded-2xl overflow-hidden border border-biz-line bg-biz-cream">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-biz-muted">No banner yet.</p>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            <Card className="p-4">
              <Button onClick={save} loading={saving}>
                Save changes
              </Button>

              <p className="mt-2 text-xs text-biz-muted">After saving, your public store page will update.</p>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}