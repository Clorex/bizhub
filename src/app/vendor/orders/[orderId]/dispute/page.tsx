"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { Input } from "@/components/ui/Input";
import { Shield, BadgeCheck } from "lucide-react";

export default function VendorDisputePage() {
  const router = useRouter();
  const params = useParams();
  const orderId = String((params as any)?.orderId ?? "");

  const [loading, setLoading] = useState(true);
  const [o, setO] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [reason, setReason] = useState("Buyer not responding");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  // Evidence photos (general)
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);

  // Apex-only enhanced evidence
  const [apexPriorityEnabled, setApexPriorityEnabled] = useState(false);
  const [timelineText, setTimelineText] = useState("");
  const [voiceNoteUrl, setVoiceNoteUrl] = useState("");
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [requestFreezeCustomer, setRequestFreezeCustomer] = useState(false);

  // Momentum add-on: priority dispute review (queue boost only)
  const [priorityReviewEnabled, setPriorityReviewEnabled] = useState(false);
  const [planKey, setPlanKey] = useState<string>("FREE");

  function addonActive(addonEntitlements: any, sku: string) {
    try {
      const e = addonEntitlements?.[sku];
      if (!e) return false;
      if (String(e.status || "") !== "active") return false;
      const exp = Number(e.expiresAtMs || 0);
      return !!(exp && exp > Date.now());
    } catch {
      return false;
    }
  }

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

        const [orderData, accessData] = await Promise.all([
          authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}`),
          authedFetch(`/api/vendor/access`),
        ]);

        if (!mounted) return;

        setO(orderData.order);

        const pk = String(accessData?.planKey || "FREE").toUpperCase();
        setPlanKey(pk);

        const feat = accessData?.features || {};
        const isApex = pk === "APEX";
        const enabled = isApex && feat?.apexPriorityDisputeOverride === true;
        setApexPriorityEnabled(!!enabled);

        const ent = accessData?.addonEntitlements || {};
        const pr = pk === "MOMENTUM" && addonActive(ent, "addon_priority_dispute_review");
        setPriorityReviewEnabled(!!pr);

        // If Apex override is not enabled, reset apex-only fields
        if (!enabled) {
          setTimelineText("");
          setVoiceNoteUrl("");
          setScreenshotUrls([]);
          setRequestFreezeCustomer(false);
        }
      } catch (e: any) {
        setMsg(e?.message || "Failed to load order");
        setO(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (orderId) load();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const canSubmit = useMemo(() => details.trim().length >= 5, [details]);

  async function submit() {
    setSending(true);
    setMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const payload: any = {
        orderId,
        reason,
        details,
        evidenceUrls,
      };

      // ✅ Apex-only enhanced evidence (server also enforces)
      if (apexPriorityEnabled) {
        payload.timelineText = timelineText;
        payload.voiceNoteUrl = voiceNoteUrl;
        payload.screenshotUrls = screenshotUrls;
        payload.requestFreezeCustomer = requestFreezeCustomer;
      }

      const r = await fetch("/api/disputes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to submit dispute");

      router.push(`/vendor/orders/${orderId}`);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSending(false);
    }
  }

  const showBuyPriorityReview = planKey === "MOMENTUM" && !priorityReviewEnabled;

  return (
    <div className="min-h-screen">
      <GradientHeader title="Report an issue" subtitle="Vendor dispute report" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && o ? (
          <>
            <SectionCard title="Order" subtitle="This report is tied to a specific order">
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  Order: <b className="text-biz-ink">#{String(orderId).slice(0, 8)}</b>
                </div>
                <div>
                  Payment: <b className="text-biz-ink">{String(o.paymentType || "—")}</b>
                </div>
                <div className="text-[11px] text-gray-500 break-all">
                  Full ID: <b className="text-biz-ink">{orderId}</b>
                </div>
              </div>
            </SectionCard>

            {apexPriorityEnabled ? (
              <Card className="p-4 border border-emerald-200 bg-emerald-50/40">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center">
                    <BadgeCheck className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-biz-ink">Apex priority dispute override</p>
                    <p className="text-[11px] text-biz-muted mt-1">
                      Your case jumps the queue and you can submit extra evidence (timeline, voice-note link, screenshots).
                    </p>
                  </div>
                </div>
              </Card>
            ) : null}

            {priorityReviewEnabled ? (
              <Card className="p-4 border border-orange-200 bg-orange-50/40">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-white border border-orange-100 flex items-center justify-center">
                    <BadgeCheck className="h-5 w-5 text-orange-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-biz-ink">Priority dispute review</p>
                    <p className="text-[11px] text-biz-muted mt-1">
                      Your disputes get a queue boost. This does not grant override powers.
                    </p>
                  </div>
                </div>
              </Card>
            ) : showBuyPriorityReview ? (
              <Card className="p-4 border border-biz-line bg-white">
                <p className="text-sm font-extrabold text-biz-ink">Want faster dispute review?</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  Buy <b className="text-biz-ink">Priority dispute review</b> to boost your dispute queue (Momentum add-on).
                </p>
                <div className="mt-3">
                  <Button size="sm" onClick={() => router.push("/vendor/purchases")}>
                    Buy Priority dispute review
                  </Button>
                </div>
              </Card>
            ) : null}

            <SectionCard title="Issue details" subtitle="Add screenshots if available">
              <select
                className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option>Buyer not responding</option>
                <option>Buyer unreachable</option>
                <option>Buyer cancelled</option>
                <option>Delivery failed</option>
                <option>Other</option>
              </select>

              <textarea
                className="mt-2 w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                placeholder="Explain what happened… (timeline, chats, delivery attempt, proof)"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={6}
              />

              <div className="mt-3 rounded-2xl border border-biz-line bg-white p-3">
                <ImageUploader
                  label="Evidence photos (optional)"
                  value={evidenceUrls}
                  onChange={setEvidenceUrls}
                  max={10}
                  folderBase="bizhub/uploads/disputes/evidence"
                  disabled={sending}
                />
                <p className="mt-2 text-[11px] text-biz-muted">Tip: Add clear screenshots/photos. Up to 10.</p>
              </div>

              {apexPriorityEnabled ? (
                <div className="mt-3 rounded-2xl border border-biz-line bg-white p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-700" />
                    <p className="text-sm font-extrabold text-biz-ink">Apex evidence pack</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-biz-ink">Timeline (optional)</p>
                    <textarea
                      className="mt-2 w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                      placeholder={`Example:\n- 10 Jan: Customer paid\n- 11 Jan: Shipped\n- 12 Jan: Delivery attempt\n- 13 Jan: Customer stopped replying`}
                      value={timelineText}
                      onChange={(e) => setTimelineText(e.target.value)}
                      rows={5}
                      disabled={sending}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-biz-ink">Voice note link (optional)</p>
                    <Input
                      placeholder="Paste a public https:// link (Drive/Dropbox/etc)"
                      value={voiceNoteUrl}
                      onChange={(e) => setVoiceNoteUrl(e.target.value)}
                      disabled={sending}
                    />
                    <p className="mt-1 text-[11px] text-biz-muted">
                      Upload voice note anywhere (Drive/Dropbox) and paste a public link.
                    </p>
                  </div>

                  <div>
                    <ImageUploader
                      label="Screenshots (optional)"
                      value={screenshotUrls}
                      onChange={setScreenshotUrls}
                      max={10}
                      folderBase="bizhub/uploads/disputes/screenshots"
                      disabled={sending}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setRequestFreezeCustomer((v) => !v)}
                    disabled={sending}
                    className="w-full rounded-2xl border border-biz-line bg-white p-3 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <p className="text-sm font-bold text-biz-ink">Request customer freeze (during investigation)</p>
                      <p className="text-[11px] text-biz-muted mt-1">
                        Admin can temporarily freeze the customer while reviewing this case.
                      </p>
                    </div>

                    <span
                      className={
                        requestFreezeCustomer
                          ? "px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100"
                      }
                    >
                      {requestFreezeCustomer ? "ON" : "OFF"}
                    </span>
                  </button>
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={submit} loading={sending} disabled={!canSubmit || sending}>
                  Submit report
                </Button>
                <Button variant="secondary" onClick={() => router.push(`/vendor/orders/${orderId}`)} disabled={sending}>
                  Back
                </Button>
              </div>

              <p className="mt-2 text-[11px] text-biz-muted">
                Note: Disputes don’t automatically freeze customers. Apex vendors can request a temporary freeze; admin decides.
              </p>
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}