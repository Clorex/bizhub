// FILE: src/app/vendor/orders/[orderId]/dispute/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { DisputeStatusBadge } from "@/components/vendor/DisputeStatusBadge";
import { DisputeCommentBubble } from "@/components/vendor/DisputeCommentBubble";
import { VendorEmptyState } from "@/components/vendor/EmptyState";
import { DetailSkeleton } from "@/components/vendor/PageSkeleton";
import { ImageUploader } from "@/components/vendor/ImageUploader";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import {
  AlertTriangle,
  RefreshCw,
  Upload,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Package,
} from "lucide-react";

function fmtNaira(n: number): string {
  if (typeof n !== "number" || isNaN(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

function fmtDate(v: any): string {
  try {
    if (!v) return "—";
    if (typeof v === "number") return new Date(v).toLocaleString("en-NG", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString("en-NG", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    if (typeof v === "string") { const d = new Date(v); if (!isNaN(d.getTime())) return d.toLocaleString("en-NG", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    return String(v);
  } catch { return "—"; }
}

export default function VendorDisputePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.orderId || "");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [order, setOrder] = useState<any>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [commentText, setCommentText] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      // Single token, parallel fetches
      const [orderRes, disputesRes] = await Promise.all([
        fetch(`/api/vendor/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/disputes`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [orderData, disputesData] = await Promise.all([
        orderRes.json().catch(() => ({})),
        disputesRes.json().catch(() => ({})),
      ]);

      setOrder(orderRes.ok ? orderData.order || null : null);
      const list = Array.isArray(disputesData.disputes) ? disputesData.disputes : [];
      setDisputes(list);

      if (list.length > 0 && !selectedDispute) {
        setSelectedDispute(list.find((d: any) => String(d.status).toLowerCase() === "open") || list[0]);
      }
    } catch (e: any) {
      setMsg(e?.message || "Could not load dispute info.");
      toast.error(e?.message || "Could not load dispute info.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (orderId) load();
    else { setMsg("Invalid order ID"); setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function submitComment() {
    if (!commentText.trim() && evidenceUrls.length === 0) return toast.error("Add a comment or evidence.");
    if (!selectedDispute) return toast.error("No dispute selected.");

    setSubmitting(true);
    setMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const r = await fetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/disputes/${selectedDispute.id}/comment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText.trim(), attachments: evidenceUrls }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Could not submit.");

      toast.success("Comment added.");
      setCommentText("");
      setEvidenceUrls([]);
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Could not submit.");
      toast.error(e?.message || "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  const amount = useMemo(() => {
    if (!order) return 0;
    return Number(order.amount || (order.amountKobo ? order.amountKobo / 100 : 0) || 0);
  }, [order]);

  const comments = useMemo(() => {
    if (!selectedDispute) return [];
    return Array.isArray(selectedDispute.comments) ? selectedDispute.comments : [];
  }, [selectedDispute]);

  const isResolved = selectedDispute?.status === "resolved" || selectedDispute?.status === "closed";

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      <GradientHeader
        title="Dispute Management"
        subtitle={`Order #${orderId.slice(0, 8)}`}
        showBack={true}
        right={
          <button onClick={load} disabled={loading} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50">
            <RefreshCw className={`w-5 h-5 text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      {/* Skeleton */}
      {loading && <DetailSkeleton />}

      {/* No disputes */}
      {!loading && disputes.length === 0 && (
        <div className="px-4 pt-4">
          {msg && <Card className="p-4 text-red-700 mb-3">{msg}</Card>}
          <Card className="p-6">
            <VendorEmptyState
              icon={CheckCircle2}
              title="No disputes"
              description="This order has no active or past disputes."
              actions={[
                { label: "View Order", onClick: () => router.push(`/vendor/orders/${orderId}`), variant: "secondary", icon: Package },
                { label: "All Orders", onClick: () => router.push("/vendor/orders"), variant: "secondary" },
              ]}
            />
          </Card>
        </div>
      )}

      {/* Disputes content */}
      {!loading && disputes.length > 0 && (
        <div className="px-4 pt-4 space-y-4">
          {msg && <Card className="p-4 text-red-700">{msg}</Card>}

          {/* Hero */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-red-100 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Disputed Order</span>
              </div>
              <p className="text-3xl font-black tracking-tight">{fmtNaira(amount)}</p>
              <p className="text-sm text-red-100 mt-2">{disputes.length} dispute{disputes.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Selector */}
          {disputes.length > 1 && (
            <SectionCard title="Select Dispute" subtitle="Choose which to view">
              <div className="space-y-2">
                {disputes.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDispute(d)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition text-left ${selectedDispute?.id === d.id ? "border-orange-300 bg-orange-50" : "border-gray-100 bg-white hover:border-orange-200"}`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{d.reason || "Dispute"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Created: {fmtDate(d.createdAt)}</p>
                    </div>
                    <DisputeStatusBadge status={d.status || "open"} />
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Details */}
          {selectedDispute && (
            <>
              <SectionCard title="Dispute Details" subtitle={`ID: ${selectedDispute.id?.slice(0, 8) || "—"}`} right={<DisputeStatusBadge status={selectedDispute.status || "open"} />}>
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl border border-gray-100 bg-white">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reason</p>
                    <p className="text-sm text-gray-900 mt-1">{selectedDispute.reason || "—"}</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-gray-100 bg-white">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Description</p>
                    <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{selectedDispute.description || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl border border-gray-100 bg-white">
                      <p className="text-xs font-bold text-gray-500 uppercase">Filed By</p>
                      <p className="text-sm text-gray-900 mt-1">{selectedDispute.filedBy === "customer" ? "Customer" : "Vendor"}</p>
                    </div>
                    <div className="p-4 rounded-2xl border border-gray-100 bg-white">
                      <p className="text-xs font-bold text-gray-500 uppercase">Created</p>
                      <p className="text-sm text-gray-900 mt-1">{fmtDate(selectedDispute.createdAt)}</p>
                    </div>
                  </div>
                  {selectedDispute.resolution && (
                    <div className="p-4 rounded-2xl border border-green-200 bg-green-50">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <p className="text-xs font-bold text-green-900 uppercase">Resolution</p>
                      </div>
                      <p className="text-sm text-green-900 whitespace-pre-wrap">{selectedDispute.resolution}</p>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Comments */}
              <SectionCard title="Discussion" subtitle={`${comments.length} comment${comments.length !== 1 ? "s" : ""}`}>
                {comments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-7 h-7 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-500">No comments yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c: any, i: number) => <DisputeCommentBubble key={i} comment={c} />)}
                  </div>
                )}
              </SectionCard>

              {/* Add Response */}
              {!isResolved && (
                <SectionCard title="Add Response" subtitle="Provide evidence or explanation">
                  <div className="space-y-3">
                    <textarea
                      className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/40 disabled:opacity-50"
                      placeholder="Explain your side…"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={4}
                      disabled={submitting}
                    />
                    <ImageUploader label="Upload Evidence" value={evidenceUrls} onChange={setEvidenceUrls} max={5} folderBase="bizhub/uploads/disputes" disabled={submitting} />
                    {evidenceUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {evidenceUrls.map((url, i) => (
                          <div key={i} className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                            <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <Button onClick={submitComment} loading={submitting} disabled={submitting || (!commentText.trim() && evidenceUrls.length === 0)} leftIcon={<Upload className="w-4 h-4" />}>
                      Submit Response
                    </Button>
                    <p className="text-xs text-gray-500">Tip: Clear evidence helps resolve disputes faster.</p>
                  </div>
                </SectionCard>
              )}

              {isResolved && (
                <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white">
                  <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">This dispute is {selectedDispute.status}</p>
                    <p className="text-xs text-gray-500 mt-0.5">No more comments allowed.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}