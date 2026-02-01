"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { RefreshCw } from "lucide-react";

function fmtDate(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return String(ms);
  }
}

function pill(text: string) {
  const t = text.toLowerCase();
  const cls =
    t.includes("trial")
      ? "bg-orange-50 text-orange-700 border-orange-100"
      : t.includes("subscription")
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-white text-gray-700 border-biz-line";

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${cls}`}>
      {text}
    </span>
  );
}

export default function AdminVendorsPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);

  async function api(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Request failed");
    return j;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const j = await api(`/api/admin/vendors${qs}`);
      setVendors(Array.isArray(j.vendors) ? j.vendors : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    let total = vendors.length;
    let activeTrial = 0;
    let activePaid = 0;

    for (const v of vendors) {
      const ent = v.entitlement || {};
      const planKey = String(ent.planKey || "FREE");
      const source = String(ent.source || "free");
      const exp = Number(ent.expiresAtMs || 0);

      if (source === "trial" && exp > Date.now()) activeTrial++;
      if (source === "subscription" && exp > Date.now()) activePaid++;
    }

    return { total, activeTrial, activePaid };
  }, [vendors]);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Vendors"
        subtitle="Search and review vendor performance"
        showBack={true}
        right={
          <Button variant="secondary" size="sm" onClick={load} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        <Card className="p-4">
          <p className="text-sm font-bold text-biz-ink">Search</p>
          <div className="mt-2 flex gap-2">
            <Input placeholder="Search by store name or slug…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button size="sm" onClick={load}>Go</Button>
          </div>

          <div className="mt-3 text-[11px] text-biz-muted">
            Total: <b className="text-biz-ink">{counts.total}</b> • Active trials:{" "}
            <b className="text-biz-ink">{counts.activeTrial}</b> • Active paid:{" "}
            <b className="text-biz-ink">{counts.activePaid}</b>
          </div>
        </Card>

        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && !msg ? (
          <SectionCard title="Vendor list" subtitle="Tap any vendor to open analytics">
            {vendors.length === 0 ? (
              <div className="text-sm text-biz-muted">No vendors found.</div>
            ) : (
              <div className="space-y-2">
                {vendors.map((v) => {
                  const ent = v.entitlement || {};
                  const planKey = String(ent.planKey || "FREE");
                  const source = String(ent.source || "free");
                  const exp = Number(ent.expiresAtMs || 0);

                  const accessLabel =
                    planKey === "FREE"
                      ? "Free"
                      : source === "trial"
                        ? `Trial • ${planKey}`
                        : `Subscribed • ${planKey}`;

                  return (
                    <button
                      key={v.id}
                      className="w-full text-left rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition"
                      onClick={() => router.push(`/admin/vendors/${v.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-biz-ink">
                            {v.name || "Business"}{" "}
                            <span className="text-biz-muted">({v.slug || "—"})</span>
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {pill(accessLabel)}
                            {planKey !== "FREE" ? (
                              <span className="text-[11px] text-gray-500">
                                Expires: <b className="text-biz-ink">{fmtDate(exp)}</b>
                              </span>
                            ) : null}
                          </div>

                          {v.ownerEmail ? (
                            <p className="mt-2 text-[11px] text-gray-500 break-all">
                              Owner: <b className="text-biz-ink">{v.ownerEmail}</b>
                            </p>
                          ) : null}
                        </div>

                        <div className="text-gray-400 font-bold">›</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}