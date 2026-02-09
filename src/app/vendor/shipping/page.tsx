"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";

type ShipType = "delivery" | "pickup";

function toNgnFromKobo(kobo: number) {
  return Math.round(Number(kobo || 0) / 100);
}
function toKoboFromNgn(ngn: number) {
  const n = Math.floor(Number(ngn || 0) * 100);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  return m.length > 140 ? fallback : m;
}

export default function VendorShippingPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [options, setOptions] = useState<any[]>([]);

  // form
  const [editingId, setEditingId] = useState<string>("");
  const [type, setType] = useState<ShipType>("delivery");
  const [name, setName] = useState("Delivery");
  const [feeNgn, setFeeNgn] = useState<number | "">("");
  const [etaDays, setEtaDays] = useState<number | "">("");
  const [areasText, setAreasText] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string>("");

  const savingDisabled = useMemo(() => {
    if (saving) return true;
    if (!name.trim()) return true;
    if (type === "delivery" && (feeNgn === "" || feeNgn < 0)) return true;
    if (etaDays === "" || etaDays < 0) return true;
    return false;
  }, [name, type, feeNgn, etaDays, saving]);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please log in again to continue.");

    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "We couldn’t complete that request.");
    return data;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await authedFetch("/api/vendor/shipping");
      setOptions(Array.isArray(data.options) ? data.options : []);
    } catch (e: any) {
      const m = niceError(e, "Could not load shipping options. Please try again.");
      setMsg(m);
      setOptions([]);
      toast.error(m);
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
    setName("");
    setFeeNgn("");
    setEtaDays("");
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
    setSaving(true);
    try {
      await authedFetch("/api/vendor/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          type,
          name: name.trim(),
          feeKobo: type === "pickup" ? 0 : toKoboFromNgn(Number(feeNgn || 0)),
          etaDays: Number(etaDays || 0),
          areasText: areasText.trim(),
          sortOrder,
          active,
        }),
      });

      toast.success(editingId ? "Shipping option updated." : "Shipping option added.");
      resetForm();
      await load();
    } catch (e: any) {
      const m = niceError(e, "Could not save. Please try again.");
      setMsg(m);
      toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const ok = confirm("Delete this shipping option? This cannot be undone.");
    if (!ok) return;

    setDeletingId(id);
    setMsg(null);
    try {
      await authedFetch(`/api/vendor/shipping?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("Shipping option deleted.");
      await load();
    } catch (e: any) {
      const m = niceError(e, "Could not delete. Please try again.");
      setMsg(m);
      toast.error(m);
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Shipping" subtitle="Set delivery and pickup options for checkout" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        <SectionCard
          title={editingId ? "Edit option" : "New option"}
          subtitle="Customers will see these at checkout"
          right={
            editingId ? (
              <Button variant="secondary" size="sm" onClick={resetForm} disabled={saving}>
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

            <Input 
              placeholder="Name (e.g. Lagos Mainland Delivery)" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Fee (₦) e.g. 2500"
                value={type === "pickup" ? "0" : feeNgn}
                onChange={(e) => setFeeNgn(e.target.value ? Number(e.target.value) : "")}
                disabled={type === "pickup"}
              />
              <Input
                type="number"
                placeholder="ETA (Days) e.g. 2"
                value={etaDays}
                onChange={(e) => setEtaDays(e.target.value ? Number(e.target.value) : "")}
                min={0}
                max={30}
              />
            </div>

            <Input
              placeholder="Areas (optional) e.g. Ikeja, Yaba, Surulere"
              value={areasText}
              onChange={(e) => setAreasText(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Sort order (0 for top)"
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
                disabled={saving}
              >
                {active ? "Active" : "Inactive"}
              </button>
            </div>

            <Button onClick={save} disabled={savingDisabled} loading={saving}>
              {editingId ? "Save changes" : "Add option"}
            </Button>
            <p className="text-[11px] text-biz-muted">Note: Pickup options always have a ₦0 fee.</p>
          </div>
        </SectionCard>

        <SectionCard title="Current options" subtitle="Tap Edit to modify">
          {options.length === 0 ? (
            <p className="text-sm text-biz-muted">No shipping options yet. Add one above.</p>
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
                        <p className="text-sm font-bold text-biz-ink">{o.name || (isPickup ? "Pickup" : "Delivery")}</p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Type: <b className="text-biz-ink">{isPickup ? "Pickup" : "Delivery"}</b> • Fee:{" "}
                          <b className="text-biz-ink">₦{(feeKobo / 100).toLocaleString()}</b> • ETA:{" "}
                          <b className="text-biz-ink">{Number(o.etaDays || 0)} day(s)</b>
                        </p>
                        {o.areasText ? <p className="text-[11px] text-gray-500 mt-1">{String(o.areasText)}</p> : null}
                        <p className="text-[11px] text-gray-500 mt-1">
                          Status: <b className="text-biz-ink">{o.active === false ? "Inactive" : "Active"}</b> • Sort:{" "}
                          <b className="text-biz-ink">{Number(o.sortOrder || 0)}</b>
                        </p>
                      </div>
                      <div className="shrink-0 space-y-2">
                        <Button size="sm" variant="secondary" onClick={() => edit(o)} disabled={saving || deletingId === id}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => del(id)} disabled={saving || deletingId === id} loading={deletingId === id}>Delete</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3">
            <Button variant="secondary" onClick={load} disabled={loading || saving}>Refresh</Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}