// FILE: src/app/vendor/customers/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { VendorEmptyState } from "@/components/vendor/EmptyState";
import { ListSkeleton } from "@/components/vendor/PageSkeleton";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";

import {
  RefreshCw,
  Download,
  Search,
  Users,
  Star,
  AlertTriangle,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  Save,
  Lock,
  Zap,
  X,
  Phone,
  Mail,
  ShoppingCart,
  Plus,
  MessageCircle,
  ChevronRight,
} from "lucide-react";

/* ─────────────────────── Helpers ─────────────────────── */

function fmtNaira(n: number) {
  try { return `₦${Number(n || 0).toLocaleString("en-NG")}`; }
  catch { return `₦${n}`; }
}

function fmtDate(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

/* ─────────────────────── Main Component ─────────────────────── */

export default function VendorCustomersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Notes state
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState<string | null>(null);

  /* ─── Authed fetch ─── */
  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (init?.body && !(init.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const r = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers as any) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }, []);

  /* ─── Load ─── */
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await authedFetch("/api/vendor/customers");
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setMeta(data.meta || null);
      if (isRefresh) toast.success("Customers refreshed!");
    } catch (e: any) {
      setError(e?.message || "Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  /* ─── Export ─── */
  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/vendor/customers/export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error || "Export failed");
      }
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") || "";
      const match = cd.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || `customers_${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Customers exported!");
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  /* ─── Save notes ─── */
  const saveNotes = useCallback(async (customer: any) => {
    setSavingNotes(customer.customerKey);
    try {
      const res = await authedFetch("/api/vendor/customers/notes", {
        method: "PUT",
        body: JSON.stringify({
          customerKey: customer.customerKey,
          vip: !!customer.notes?.vip,
          debt: !!customer.notes?.debt,
          issue: !!customer.notes?.issue,
          note: String(customer.notes?.note || ""),
          debtAmount: Number(customer.notes?.debtAmount || 0),
        }),
      });
      setCustomers((prev) =>
        prev.map((x) => x.customerKey === customer.customerKey ? { ...x, notes: res.note } : x)
      );
      toast.success("Notes saved!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save notes");
    } finally {
      setSavingNotes(null);
    }
  }, [authedFetch]);

  /* ─── Derived ─── */
  const planKey = String(meta?.planKey || "FREE").toUpperCase();
  const exportUnlocked = !!meta?.limits?.customersExportUnlocked;
  const notesUnlocked = !!meta?.limits?.customerNotesUnlocked;
  const visibleCap = Number(meta?.limits?.customersVisible || customers.length);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = String(c.fullName || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      const email = String(c.email || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [customers, searchQuery]);

  const totalSpent = useMemo(
    () => customers.reduce((sum, c) => sum + Number(c.totalSpent || 0), 0),
    [customers]
  );

  /* ─── Update customer note field locally ─── */
  function updateCustomerNote(key: string, field: string, value: any) {
    setCustomers((prev) =>
      prev.map((c) =>
        c.customerKey === key
          ? { ...c, notes: { ...(c.notes || {}), [field]: value } }
          : c
      )
    );
  }

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Customers" subtitle="Loading..." showBack={true} />
        <ListSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length !== 1 ? "s" : ""}`}
        showBack={true}
        right={
          <div className="flex items-center gap-2">
            {exportUnlocked && (
              <button
                onClick={exportCsv}
                disabled={exporting || customers.length === 0}
                className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
              >
                <Download className={cn("w-5 h-5 text-white", exporting && "animate-pulse")} />
              </button>
            )}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
            >
              <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
            </button>
          </div>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        {/* Error */}
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </Card>
        )}

        {/* Summary Card */}
        {customers.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <Users className="w-5 h-5 text-blue-600 mx-auto" />
              <p className="text-lg font-black text-gray-900 mt-2">{customers.length}</p>
              <p className="text-[11px] text-gray-500">Customers</p>
            </Card>
            <Card className="p-3 text-center">
              <DollarSign className="w-5 h-5 text-green-600 mx-auto" />
              <p className="text-lg font-black text-gray-900 mt-2">{fmtNaira(totalSpent)}</p>
              <p className="text-[11px] text-gray-500">Total Spent</p>
            </Card>
            <Card className="p-3 text-center">
              <ShoppingCart className="w-5 h-5 text-orange-600 mx-auto" />
              <p className="text-lg font-black text-gray-900 mt-2">
                {customers.reduce((s, c) => s + Number(c.ordersCount || 0), 0)}
              </p>
              <p className="text-[11px] text-gray-500">Total Orders</p>
            </Card>
          </div>
        )}

        {/* Export Lock Notice */}
        {!exportUnlocked && customers.length > 0 && (
          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800">CSV export locked</p>
                <p className="text-xs text-orange-600 mt-0.5">Upgrade to export your customer list.</p>
                <Button size="sm" className="mt-2" onClick={() => router.push("/vendor/subscription")} leftIcon={<Zap className="w-4 h-4" />}>
                  Upgrade
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Search */}
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
              >
                <X className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </div>
        </Card>

        {/* Empty States */}
        {customers.length === 0 && !error && (
          <VendorEmptyState
            icon={Users}
            title="No customers yet"
            description="Customers will appear here after your first order."
            actions={[
              { label: "Add Product", onClick: () => router.push("/vendor/products/new"), icon: Plus, variant: "primary" },
              { label: "View Orders", onClick: () => router.push("/vendor/orders"), icon: ShoppingCart, variant: "secondary" },
            ]}
          />
        )}

        {customers.length > 0 && filtered.length === 0 && (
          <VendorEmptyState
            icon={Search}
            title="No matches"
            description="Try a different search term."
            compact
            actions={[
              { label: "Clear", onClick: () => setSearchQuery(""), variant: "secondary" },
            ]}
          />
        )}

        {/* Customer List */}
        <div className="space-y-3">
          {filtered.map((c) => {
            const isExpanded = expandedCustomer === c.customerKey;
            const hasVip = !!c.notes?.vip;
            const hasDebt = !!c.notes?.debt;
            const hasIssue = !!c.notes?.issue;
            const initial = (c.fullName || c.phone || "?")[0]?.toUpperCase() || "?";

            return (
              <Card key={c.customerKey} className="overflow-hidden">
                {/* Main Row */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
                      hasVip
                        ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                        : "bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600"
                    )}>
                      {initial}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {c.fullName || c.phone || c.email || "Customer"}
                      </p>

                      {c.phone && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </p>
                      )}
                      {c.email && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3" /> {c.email}
                        </p>
                      )}

                      {/* Tags */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {hasVip && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold flex items-center gap-1">
                            <Star className="w-3 h-3" /> VIP
                          </span>
                        )}
                        {hasDebt && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold">
                            Debt {c.notes?.debtAmount ? fmtNaira(c.notes.debtAmount) : ""}
                          </span>
                        )}
                        {hasIssue && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Issue
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                          {c.ordersCount || 0} orders
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Last order: {fmtDate(Number(c.lastOrderMs || 0))}
                      </p>
                    </div>

                    {/* Amount + Expand */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{fmtNaira(Number(c.totalSpent || 0))}</p>
                      <p className="text-[11px] text-gray-400">total spent</p>

                      {notesUnlocked && (
                        <button
                          onClick={() => setExpandedCustomer(isExpanded ? null : c.customerKey)}
                          className="mt-2 text-xs font-medium text-orange-600 flex items-center gap-0.5 ml-auto"
                        >
                          Notes
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes Panel */}
                {notesUnlocked && isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                    {/* Tag Toggles */}
                    <div className="flex flex-wrap gap-3">
                      {[
                        { key: "vip", label: "VIP", icon: Star },
                        { key: "debt", label: "Debt", icon: DollarSign },
                        { key: "issue", label: "Issue", icon: AlertTriangle },
                      ].map(({ key, label, icon: Icon }) => (
                        <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!c.notes?.[key]}
                            onChange={(e) => updateCustomerNote(c.customerKey, key, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <Icon className="w-3.5 h-3.5 text-gray-500" />
                          {label}
                        </label>
                      ))}
                    </div>

                    {/* Debt Amount */}
                    {c.notes?.debt && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Debt Amount (₦)
                        </label>
                        <Input
                          inputMode="numeric"
                          value={String(c.notes?.debtAmount ?? "")}
                          onChange={(e) => {
                            const v = Number(String(e.target.value).replace(/[^\d.]/g, "")) || 0;
                            updateCustomerNote(c.customerKey, "debtAmount", v);
                          }}
                          placeholder="0"
                        />
                      </div>
                    )}

                    {/* Note Text */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                      <textarea
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
                        rows={3}
                        value={String(c.notes?.note || "")}
                        onChange={(e) => updateCustomerNote(c.customerKey, "note", e.target.value)}
                        placeholder="Add a private note about this customer..."
                      />
                    </div>

                    {/* Save */}
                    <Button
                      size="sm"
                      loading={savingNotes === c.customerKey}
                      onClick={() => saveNotes(c)}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Save Notes
                    </Button>
                  </div>
                )}

                {/* Notes locked message */}
                {!notesUnlocked && (
                  <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Customer notes locked</span>
                    <button
                      onClick={() => router.push("/vendor/subscription")}
                      className="text-xs font-medium text-orange-600 flex items-center gap-1"
                    >
                      Upgrade <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Plan Info */}
        {meta && customers.length > 0 && (
          <p className="text-xs text-gray-400 text-center pt-2">
            Plan: {planKey} · Showing up to {visibleCap} customers
          </p>
        )}
      </div>
    </div>
  );
}