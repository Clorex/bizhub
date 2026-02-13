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
import { RefreshCw, Truck, MapPin, Edit3, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/cn";

type ShipType = "delivery" | "pickup";

function toNgnFromKobo(kobo: number) {
  return Math.round(Number(kobo || 0) / 100);
}
function toKoboFromNgn(ngn: number) {
  const n = Math.floor(Number(ngn || 0) * 100);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function fmtFee(kobo: number) {
  const ngn = Math.round(Number(kobo || 0) / 100);
  return `\u20A6${ngn.toLocaleString("en-NG")}`;
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
  const [name, setName] = useState("");
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
    if (!r.ok) throw new Error(data?.error || "We couldn\u2019t complete that request.");
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
    setName(String(o.name || ""));
    setFeeNgn(toNgnFromKobo(Number(o.feeKobo || 0)));
    setEtaDays(Number(o.etaDays || 0));
    setAreasText(String(o.areasText || ""));
    setSortOrder(Number(o.sortOrder || 0));
    setActive(o.active === false ? false : true);

    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const activeOptions = options.filter((o) => o.active !== false);
  const inactiveOptions = options.filter((o) => o.active === false);

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader title="Shipping" subtitle="Set delivery and pickup options for checkout" showBack={true} />

      <div className="px-4 pb-24 space-y-4">
        {loading ? (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-orange-300 border-t-transparent animate-spin" />
              <span className="text-sm text-gray-500">Loading shipping options\u2026</span>
            </div>
          </Card>
        ) : null}

        {msg ? (
          <Card className="p-4">
            <p className="text-sm text-red-700">{msg}</p>
          </Card>
        ) : null}

        {/* ──────────── Form ──────────── */}
        <SectionCard
          title={editingId ? "Edit shipping option" : "Add new option"}
          subtitle="Customers will see these options at checkout"
          right={
            editingId ? (
              <Button variant="secondary" size="sm" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            ) : null
          }
        >
          <div className="space-y-3">
            <SegmentedControl<ShipType>
              value={type}
              onChange={(v) => {
                setType(v);
                if (v === "pickup") setFeeNgn(0);
              }}
              options={[
                { value: "delivery", label: "Delivery" },
                { value: "pickup", label: "Pickup" },
              ]}
            />

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Option name</label>
              <Input
                placeholder={type === "pickup" ? "e.g. Pickup from shop" : "e.g. Lagos Mainland Delivery"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  {type === "pickup" ? "Fee" : "Delivery fee (\u20A6)"}
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 1,500"
                  value={type === "pickup" ? "0" : feeNgn}
                  onChange={(e) => setFeeNgn(e.target.value ? Number(e.target.value) : "")}
                  disabled={type === "pickup"}
                  min={0}
                />
                {type === "pickup" && (
                  <p className="text-[10px] text-gray-400 mt-1">Pickup is always free</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  Estimated delivery time (days)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 2"
                  value={etaDays}
                  onChange={(e) => setEtaDays(e.target.value ? Number(e.target.value) : "")}
                  min={0}
                  max={30}
                />
                <p className="text-[10px] text-gray-400 mt-1">How many days until the customer receives it</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Coverage / notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <Input
                placeholder="e.g. Only within Lagos mainland"
                value={areasText}
                onChange={(e) => setAreasText(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">Describe the areas you cover or any special instructions</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  Sort order <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={String(sortOrder)}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  min={0}
                />
                <p className="text-[10px] text-gray-400 mt-1">Lower numbers appear first</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-2xl px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition",
                    active
                      ? "text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm"
                      : "bg-white border border-gray-200 text-gray-500"
                  )}
                  onClick={() => setActive((v) => !v)}
                  disabled={saving}
                >
                  {active ? (
                    <>
                      <ToggleRight className="w-4 h-4" />
                      Active
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4" />
                      Inactive
                    </>
                  )}
                </button>
              </div>
            </div>

            <Button onClick={save} disabled={savingDisabled} loading={saving}>
              {editingId ? "Save changes" : "Add option"}
            </Button>
          </div>
        </SectionCard>

        {/* ──────────── Active Options ──────────── */}
        {!loading && activeOptions.length > 0 && (
          <SectionCard
            title="Active options"
            subtitle={`${activeOptions.length} option${activeOptions.length !== 1 ? "s" : ""} visible to customers`}
          >
            <div className="space-y-3">
              {activeOptions.map((o) => (
                <ShippingOptionCard
                  key={o.id}
                  option={o}
                  onEdit={() => edit(o)}
                  onDelete={() => del(String(o.id))}
                  saving={saving}
                  deleting={deletingId === String(o.id)}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {/* ──────────── Inactive Options ──────────── */}
        {!loading && inactiveOptions.length > 0 && (
          <SectionCard
            title="Inactive options"
            subtitle="Not shown to customers at checkout"
          >
            <div className="space-y-3">
              {inactiveOptions.map((o) => (
                <ShippingOptionCard
                  key={o.id}
                  option={o}
                  onEdit={() => edit(o)}
                  onDelete={() => del(String(o.id))}
                  saving={saving}
                  deleting={deletingId === String(o.id)}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {/* ──────────── Empty state ──────────── */}
        {!loading && options.length === 0 && !msg && (
          <Card className="p-5 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Truck className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <p className="text-sm font-bold text-gray-900">No shipping options yet</p>
            <p className="text-xs text-gray-500 mt-1">Add a delivery or pickup option above so customers can choose at checkout.</p>
          </Card>
        )}

        {/* Refresh */}
        {!loading && options.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={load}
              disabled={loading || saving}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────── Shipping Option Card ──────────── */

function ShippingOptionCard({
  option,
  onEdit,
  onDelete,
  saving,
  deleting,
}: {
  option: any;
  onEdit: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const isPickup = String(option.type || "delivery") === "pickup";
  const feeKobo = Number(option.feeKobo || 0);
  const etaDays = Number(option.etaDays || 0);
  const isActive = option.active !== false;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 transition",
        isActive ? "border-emerald-200" : "border-gray-100 opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              isPickup ? "bg-blue-50" : "bg-orange-50"
            )}
          >
            {isPickup ? (
              <MapPin className="w-5 h-5 text-blue-600" />
            ) : (
              <Truck className="w-5 h-5 text-orange-600" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900">
                {option.name || (isPickup ? "Pickup" : "Delivery")}
              </p>
              {isActive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                  Inactive
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs text-gray-600">
                <span className="text-gray-400">Fee:</span>{" "}
                <b className="text-gray-900">
                  {isPickup ? "Free" : fmtFee(feeKobo)}
                </b>
              </span>
              <span className="text-xs text-gray-600">
                <span className="text-gray-400">Delivery time:</span>{" "}
                <b className="text-gray-900">
                  {etaDays === 0 ? "Same day" : `${etaDays} day${etaDays !== 1 ? "s" : ""}`}
                </b>
              </span>
            </div>

            {option.areasText ? (
              <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                {String(option.areasText)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onEdit}
          disabled={saving || deleting}
          leftIcon={<Edit3 className="w-3.5 h-3.5" />}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={onDelete}
          disabled={saving || deleting}
          loading={deleting}
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
