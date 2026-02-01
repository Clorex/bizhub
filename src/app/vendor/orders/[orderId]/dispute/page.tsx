// FILE: src/app/vendor/orders/[orderId]/dispute/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { ImageUploader } from "@/components/vendor/ImageUploader";

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

  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);

  async function authedFetch(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
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

        const data = await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}`);
        if (!mounted) return;
        setO(data.order);
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

      const r = await fetch("/api/disputes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId,
          reason,
          details,
          evidenceUrls,
        }),
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

  function removeEvidence(url: string) {
    setEvidenceUrls((prev) => prev.filter((x) => x !== url));
  }

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
                  label="Upload evidence"
                  multiple={true}
                  onUploaded={(urls) => setEvidenceUrls((prev) => [...prev, ...urls].slice(0, 10))}
                />

                {evidenceUrls.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {evidenceUrls.map((u) => (
                      <div key={u} className="rounded-2xl border border-biz-line overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Evidence" className="h-24 w-full object-cover" />
                        <button
                          className="w-full py-2 text-xs font-bold text-red-600 bg-white"
                          type="button"
                          onClick={() => removeEvidence(u)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-biz-muted">No evidence uploaded yet.</p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={submit} loading={sending} disabled={!canSubmit || sending}>
                  Submit report
                </Button>
                <Button variant="secondary" onClick={() => router.push(`/vendor/orders/${orderId}`)} disabled={sending}>
                  Back
                </Button>
              </div>

              <p className="mt-2 text-[11px] text-biz-muted">
                Note: opening a dispute freezes buyer actions until resolved.
              </p>
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}