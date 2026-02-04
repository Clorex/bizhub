"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { onAuthStateChanged } from "firebase/auth";
import { ImageUploader } from "@/components/vendor/ImageUploader";

export default function DisputePage() {
  const router = useRouter();
  const params = useParams();
  const orderId = String((params as any)?.orderId ?? "");

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [o, setO] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [reason, setReason] = useState("Not delivered");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(false);
      if (!u) {
        setLoggedIn(false);
        router.replace(`/account/login?next=${encodeURIComponent(`/orders/${orderId}/dispute`)}`);
        return;
      }
      setLoggedIn(true);
    });
    return () => unsub();
  }, [router, orderId]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setMsg(null);

        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Not logged in");

        const r = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load order");

        if (!mounted) return;
        setO(data.order || null);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load order");
        setO(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (orderId && loggedIn) run();
    return () => {
      mounted = false;
    };
  }, [orderId, loggedIn]);

  const canSubmit = useMemo(() => {
    if (!reason) return false;
    if (details.trim().length < 5) return false;
    return true;
  }, [reason, details]);

  async function submit() {
    setMsg(null);
    setSending(true);
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

      router.push(`/orders/${orderId}`);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSending(false);
    }
  }

  if (authLoading || !loggedIn) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Raise a dispute" subtitle="Preparing…" showBack={true} />
        <div className="px-4 pb-24">
          <Card className="p-4">Loading…</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Raise a dispute" subtitle="Tell us what went wrong" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && o ? (
          <>
            <SectionCard title="Order" subtitle="Confirm you’re disputing the right order">
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  Order ID: <b className="text-biz-ink">{orderId}</b>
                </div>
                <div>
                  Store: <b className="text-biz-ink">{o?.businessSlug || "—"}</b>
                </div>
                <div className="text-[11px] text-biz-muted">
                  Payment: {o?.paymentType || "—"} • Status: {o?.escrowStatus || o?.orderStatus || "—"}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Dispute details" subtitle="Add screenshots if you have evidence">
              <select
                className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option>Not delivered</option>
                <option>Wrong item</option>
                <option>Damaged item</option>
                <option>Vendor not responding</option>
                <option>Other</option>
              </select>

              <textarea
                className="mt-2 w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                placeholder="Explain what happened (dates, delivery info, proof)…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={6}
              />

              <div className="mt-3 rounded-2xl border border-biz-line bg-white p-3">
                <ImageUploader
                  label="Upload evidence (screenshots/photos)"
                  value={evidenceUrls}
                  onChange={setEvidenceUrls}
                  max={10}
                  folderBase="bizhub/uploads/disputes/buyer-evidence"
                  disabled={sending}
                />
              </div>

              <div className="mt-3">
                <Button onClick={submit} loading={sending} disabled={!canSubmit || sending}>
                  Submit dispute
                </Button>
              </div>

              <p className="mt-2 text-[11px] text-biz-muted">
                Disputes are reviewed by BizHub. Provide clear evidence to help resolve faster.
              </p>
            </SectionCard>

            <Card className="p-4">
              <Button variant="secondary" onClick={() => router.push(`/orders/${orderId}`)}>
                Back to order
              </Button>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}