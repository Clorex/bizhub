"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";

type ShipType = "delivery" | "pickup";

function toNgnFromKobo(kobo: number) {
  return Math.round(Number(kobo || 0) / 100);
}
function toKoboFromNgn(ngn: number) {
  const n = Math.floor(Number(ngn || 0) * 100);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export default function VendorShippingPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [options, setOptions] = useState<any[]>([]);

  // form
  const [editingId, setEditingId] = useState<string>("");
  const [type, setType] = useState<ShipType>("delivery");
  const [name, setName] = useState("Delivery");
  const [feeNgn, setFeeNgn] = useState<number>(2000);
  const [etaDays, setEtaDays] = useState<number>(2);
  const [areasText, setAreasText] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [active, setActive] = useState(true);

  const savingDisabled = useMemo(() => {
    if (!name.trim()) return true;
    if (type === "delivery" && feeNgn < 0) return true;
    return false;
  }, [name, type, feeNgn]);

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

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await authedFetch("/api/vendor/shipping");
      setOptions(Array.isArray(data.options) ? data.options : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load shipping options");
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId("");
    setType("delivery");
    setName("Delivery");
    setFeeNgn(2000);
    setEtaDays(2);
    setAreasText("");
    setSortOrder(0);
    setActive(true);
  }

  function edit(o: any) {
    setEditingId(String(o.id || ""));
    setType(String(o.type || "delivery") === "pickup" ? "pickup" : "delivery");
    setName(String(o.name || "Delivery"));
    setFeeNgn(toNgnFromKobo(Number(o.feeKobo || 0)));
    setEtaDays(Number(o.etaDays || 0));
    setAreasText(String(o.areasText || ""));
    setSortOrder(Number(o.sortOrder || 0));
    setActive(o.active === false ? false : true);
  }

  async function save() {
    setMsg(null);
    try {
      await authedFetch("/api/vendor/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          type,
          name: name.trim(),
          feeKobo: type === "pickup" ? 0 : toKoboFromNgn(feeNgn),
          etaDays,
          areasText: areasText.trim(),
          sortOrder,
          active,
        }),
      });
      setMsg(editingId ? "Shipping option updated." : "Shipping option created.");
      resetForm();
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this shipping option?")) return;
    try {
      await authedFetch(`/api/vendor/shipping?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Shipping" subtitle="Create delivery & pickup options for checkout" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4">{msg}</Card> : null}

        <SectionCard
          title={editingId ? "Edit shipping option" : "New shipping option"}
          subtitle="These appear on customer checkout"
          right={
            editingId ? (
              <Button variant="secondary" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            ) : null
          }
        >
          <div className="space-y-2">
            <SegmentedControl<ShipType>
              value={type}
              onChange={setType}
              options={[
                { value: "delivery", label: "Delivery" },
                { value: "pickup", label: "Pickup" },
              ]}
            />

            <Input placeholder="Name (e.g. Lagos delivery)" value={name} onChange={(e) => setName(e.target.value)} />

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Fee (NGN)"
                value={String(type === "pickup" ? 0 : feeNgn)}
                onChange={(e) => setFeeNgn(Number(e.target.value))}
                disabled={type === "pickup"}
              />
              <Input
                type="number"
                placeholder="ETA days"
                value={String(etaDays)}
                onChange={(e) => setEtaDays(Number(e.target.value))}
                min={0}
                max={30}
              />
            </div>

            <Input
              placeholder="Areas (optional) e.g. Lekki, VI, Ajah"
              value={areasText}
              onChange={(e) => setAreasText(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Sort order (0..)"
                value={String(sortOrder)}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />

              <button
                type="button"
                className={
                  active
                    ? "rounded-2xl px-4 py-3 text-sm font-bold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                    : "rounded-2xl px-4 py-3 text-sm font-bold bg-white border border-biz-line text-biz-ink shadow-soft"
                }
                onClick={() => setActive((v) => !v)}
              >
                {active ? "Active" : "Inactive"}
              </button>
            </div>

            <Button onClick={save} disabled={savingDisabled}>
              {editingId ? "Save changes" : "Create option"}
            </Button>

            <p className="text-[11px] text-biz-muted">
              Note: Pickup fee is forced to ₦0 in the API (MVP).
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Current options" subtitle="Tap Edit to modify">
          {options.length === 0 ? (
            <p className="text-sm text-biz-muted">No shipping options yet. Create one above.</p>
          ) : (
            <div className="space-y-2">
              {options.map((o) => {
                const id = String(o.id);
                const isPickup = String(o.type || "delivery") === "pickup";
                const feeKobo = Number(o.feeKobo || 0);

                return (
                  <div key={id} className="rounded-2xl border border-biz-line bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-biz-ink">
                          {o.name || (isPickup ? "Pickup" : "Delivery")}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Type: <b className="text-biz-ink">{isPickup ? "pickup" : "delivery"}</b> • Fee:{" "}
                          <b className="text-biz-ink">₦{(feeKobo / 100).toLocaleString()}</b> • ETA:{" "}
                          <b className="text-biz-ink">{Number(o.etaDays || 0)} day(s)</b>
                        </p>
                        {o.areasText ? <p className="text-[11px] text-gray-500 mt-1">{String(o.areasText)}</p> : null}
                        <p className="text-[11px] text-gray-500 mt-1">
                          Status: <b className="text-biz-ink">{o.active === false ? "inactive" : "active"}</b> • Sort:{" "}
                          <b className="text-biz-ink">{Number(o.sortOrder || 0)}</b>
                        </p>
                      </div>

                      <div className="shrink-0 space-y-2">
                        <Button size="sm" variant="secondary" onClick={() => edit(o)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => del(id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3">
            <Button variant="secondary" onClick={load}>
              Refresh
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}