"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { RefreshCw, Download } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function fmtDateMs(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function Chip({ children, tone }: { children: any; tone: "green" | "orange" | "red" | "gray" }) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "orange"
        ? "bg-orange-50 text-orange-700 border-orange-100"
        : tone === "red"
          ? "bg-rose-50 text-rose-700 border-rose-100"
          : "bg-gray-50 text-gray-700 border-gray-100";

  return <span className={`px-2 py-1 rounded-full text-[11px] font-bold border ${cls}`}>{children}</span>;
}

export default function VendorCustomersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  const [q, setQ] = useState("");
  const [includeContactsOptedOut, setIncludeContactsOptedOut] = useState(false);

  // Notes UI state
  const [openNotesKey, setOpenNotesKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function authedFetchJson(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const isJsonBody = init?.body && !(init.body instanceof FormData);
    if (isJsonBody) headers["Content-Type"] = "application/json";

    const r = await fetch(path, {
      ...init,
      headers: { ...headers, ...(init?.headers as any) },
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function load() {
    try {
      setLoading(true);
      setMsg(null);
      const data = await authedFetchJson("/api/vendor/customers");
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setMeta(data.meta || null);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load customers");
      setCustomers([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    try {
      setExporting(true);
      setMsg(null);

      const token = await auth.currentUser?.getIdToken();
      const qs = includeContactsOptedOut ? "?includeContacts=1" : "";
      const r = await fetch(`/api/vendor/customers/export${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        const err = String(data?.error || "Export failed");
        setMsg(err);
        return;
      }

      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/i);
      const filename = m?.[1] || `customers_export_${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setMsg(e?.message || "Failed to export");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const planKey = String(meta?.planKey || "FREE");
  const exportUnlocked = !!meta?.limits?.customersExportUnlocked;
  const notesUnlocked = !!meta?.limits?.customerNotesUnlocked;
  const visibleCap = Number(meta?.limits?.customersVisible || customers.length || 0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => {
      const name = String(c.fullName || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      const email = String(c.email || "").toLowerCase();
      return name.includes(s) || phone.includes(s) || email.includes(s);
    });
  }, [customers, q]);

  const noCustomersYet = !loading && customers.length === 0;
  const noMatches = !loading && customers.length > 0 && filtered.length === 0;

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Customers"
        subtitle="People who bought from your store"
        showBack={true}
        right={
          <IconButton aria-label="Refresh" onClick={load} disabled={loading}>
            <RefreshCw className="h-5 w-5 text-gray-700" />
          </IconButton>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-extrabold text-biz-ink">Overview</p>
              <p className="text-xs text-biz-muted mt-1">
                {customers.length} customer(s) found • showing up to {visibleCap}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Plan: <b className="text-biz-ink">{planKey}</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={exportCsv}
                loading={exporting}
                disabled={loading || exporting || !exportUnlocked}
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={load} loading={loading}>
                Refresh
              </Button>
            </div>
          </div>

          {!exportUnlocked ? (
            <div className="mt-3">
              <Card variant="soft" className="p-3">
                <p className="text-sm font-bold text-biz-ink">CSV export locked</p>
                <p className="text-[11px] text-biz-muted mt-1">Upgrade your plan to export customer lists.</p>
                <div className="mt-2">
                  <Button size="sm" onClick={() => router.push("/vendor/subscription")}>
                    Upgrade
                  </Button>
                </div>
              </Card>
            </div>
          ) : null}

          <div className="mt-3 grid gap-2">
            <Input placeholder="Search name / phone / email" value={q} onChange={(e) => setQ(e.target.value)} />

            <button
              type="button"
              className="w-full rounded-2xl border border-biz-line bg-white p-3 flex items-center justify-between"
              onClick={() => setIncludeContactsOptedOut((v) => !v)}
              disabled={!exportUnlocked}
            >
              <div className="text-left">
                <p className="text-sm font-bold text-biz-ink">Include contacts for opted-out customers</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  Default export hides phone/email for opted-out customers (recommended).
                </p>
              </div>
              <span
                className={
                  includeContactsOptedOut
                    ? "px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100"
                }
              >
                {includeContactsOptedOut ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </Card>

        {loading ? <Card className="p-4">Loading…</Card> : null}

        {/* ✅ Calm empty state: no customers at all */}
        {noCustomersYet ? (
          <Card className="p-5">
            <p className="text-base font-extrabold text-biz-ink">No customers yet</p>
            <p className="text-sm text-biz-muted mt-2">
              Customers will appear here after you get orders. Your first buyer will show up automatically.
            </p>

            <ul className="mt-3 text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>Add at least 1–3 products</li>
              <li>Share your store link on WhatsApp</li>
              <li>Reply fast when someone asks a question</li>
            </ul>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => router.push("/vendor/products/new")}>Add product</Button>
              <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                View orders
              </Button>

              <Button variant="secondary" className="col-span-2" onClick={() => router.push("/vendor")}>
                Back to dashboard
              </Button>
            </div>
          </Card>
        ) : null}

        {/* ✅ Calm empty state: search returns nothing */}
        {noMatches ? (
          <Card className="p-5 text-center">
            <p className="text-base font-extrabold text-biz-ink">No matches</p>
            <p className="text-sm text-biz-muted mt-2">Try a different keyword or clear your search.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setQ("")}>
                Clear search
              </Button>
              <Button variant="secondary" onClick={load}>
                Refresh
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="space-y-2">
          {filtered.map((c) => {
            const opted = !!c.marketingOptedOut;
            const scope = String(c.optOutScope || "");

            return (
              <Card key={c.customerKey} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-biz-ink">{c.fullName || c.phone || c.email || "Customer"}</p>
                    <p className="text-[11px] text-gray-500 mt-1 break-all">
                      {c.phone || "—"} • {c.email || "—"}
                    </p>

                    <p className="text-[11px] text-gray-500 mt-2">
                      Last order: {fmtDateMs(Number(c.lastOrderMs || 0))} • Orders:{" "}
                      <b className="text-biz-ink">{Number(c.ordersCount || 0)}</b>
                    </p>

                    {/* Notes tags + toggle */}
                    {notesUnlocked ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {c?.notes?.vip ? <Chip tone="green">VIP</Chip> : null}
                        {c?.notes?.debt ? <Chip tone="orange">Debt</Chip> : null}
                        {c?.notes?.issue ? <Chip tone="red">Issue</Chip> : null}
                        {!c?.notes?.vip && !c?.notes?.debt && !c?.notes?.issue ? <Chip tone="gray">No notes</Chip> : null}

                        <button
                          type="button"
                          className="ml-auto text-[11px] font-bold text-biz-ink underline"
                          onClick={() => setOpenNotesKey((prev) => (prev === c.customerKey ? null : c.customerKey))}
                        >
                          {openNotesKey === c.customerKey ? "Close" : "Notes"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <Chip tone="gray">Notes locked</Chip>
                        <button
                          type="button"
                          className="text-[11px] font-bold text-biz-ink underline"
                          onClick={() => router.push("/vendor/subscription")}
                        >
                          Upgrade
                        </button>
                      </div>
                    )}

                    {/* Notes editor */}
                    {notesUnlocked && openNotesKey === c.customerKey ? (
                      <div className="mt-3 rounded-2xl border border-biz-line bg-white p-3 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!c?.notes?.vip}
                              onChange={(e) => {
                                const vip = e.target.checked;
                                setCustomers((prev) =>
                                  prev.map((x) =>
                                    x.customerKey === c.customerKey ? { ...x, notes: { ...(x.notes || {}), vip } } : x
                                  )
                                );
                              }}
                            />
                            VIP
                          </label>

                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!c?.notes?.debt}
                              onChange={(e) => {
                                const debt = e.target.checked;
                                setCustomers((prev) =>
                                  prev.map((x) =>
                                    x.customerKey === c.customerKey
                                      ? { ...x, notes: { ...(x.notes || {}), debt, debtAmount: debt ? Number(x.notes?.debtAmount || 0) : 0 } }
                                      : x
                                  )
                                );
                              }}
                            />
                            Debt
                          </label>

                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!c?.notes?.issue}
                              onChange={(e) => {
                                const issue = e.target.checked;
                                setCustomers((prev) =>
                                  prev.map((x) =>
                                    x.customerKey === c.customerKey ? { ...x, notes: { ...(x.notes || {}), issue } } : x
                                  )
                                );
                              }}
                            />
                            Issue
                          </label>
                        </div>

                        {c?.notes?.debt ? (
                          <div>
                            <p className="text-[11px] text-biz-muted mb-1 font-bold">Debt amount (₦)</p>
                            <Input
                              inputMode="numeric"
                              value={String(c?.notes?.debtAmount ?? "")}
                              onChange={(e) => {
                                const debtAmount = Number(String(e.target.value || "0").replace(/[^\d.]/g, "")) || 0;

                                setCustomers((prev) =>
                                  prev.map((x) =>
                                    x.customerKey === c.customerKey ? { ...x, notes: { ...(x.notes || {}), debtAmount } } : x
                                  )
                                );
                              }}
                              placeholder="0"
                            />
                          </div>
                        ) : null}

                        <div>
                          <p className="text-[11px] text-biz-muted mb-1 font-bold">Note</p>
                          <textarea
                            className="w-full rounded-2xl border border-biz-line bg-white p-3 text-sm outline-none"
                            rows={3}
                            value={String(c?.notes?.note || "")}
                            onChange={(e) => {
                              const note = e.target.value;
                              setCustomers((prev) =>
                                prev.map((x) =>
                                  x.customerKey === c.customerKey ? { ...x, notes: { ...(x.notes || {}), note } } : x
                                )
                              );
                            }}
                            placeholder="Add a note about this customer..."
                          />
                        </div>

                        <Button
                          size="sm"
                          loading={savingKey === c.customerKey}
                          onClick={async () => {
                            try {
                              setSavingKey(c.customerKey);
                              setMsg(null);

                              const payload = {
                                customerKey: c.customerKey,
                                vip: !!c?.notes?.vip,
                                debt: !!c?.notes?.debt,
                                issue: !!c?.notes?.issue,
                                note: String(c?.notes?.note || ""),
                                debtAmount: Number(c?.notes?.debtAmount || 0),
                              };

                              const res = await authedFetchJson("/api/vendor/customers/notes", {
                                method: "PUT",
                                body: JSON.stringify(payload),
                              });

                              setCustomers((prev) =>
                                prev.map((x) => (x.customerKey === c.customerKey ? { ...x, notes: res.note } : x))
                              );
                            } catch (e: any) {
                              setMsg(e?.message || "Failed to save notes");
                            } finally {
                              setSavingKey(null);
                            }
                          }}
                        >
                          Save notes
                        </Button>

                        {c?.notes?.updatedAtMs ? (
                          <p className="text-[11px] text-gray-500">Last updated: {fmtDateMs(Number(c.notes.updatedAtMs || 0))}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {opted ? (
                      <p className="text-[11px] text-orange-700 mt-2">
                        Marketing opt-out: <b>{scope || "yes"}</b>
                      </p>
                    ) : null}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(Number(c.totalSpent || 0))}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Total spent</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}