"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { toast } from "@/lib/ui/toast";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";
import {
  MessageCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Sparkles,
  Search,
  Clock,
  Users,
  ShoppingCart,
  CheckCircle2,
  X,
  ChevronRight,
} from "lucide-react";
import {
  composeSmartMessage,
  segmentLabel,
  type ReengagementPerson,
  type ReengagementSegment,
  type PlanKey,
} from "@/lib/vendor/reengagement/compose";

type Mode = "buyers" | "abandoned";

function waLink(phone: string, text: string) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function fmtDate(ms: number) {
  if (!ms) return "\u2014";
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return "\u2014";
  }
}

function fmtNaira(n: number) {
  return formatMoneyNGN(Number(n || 0));
}

function defaultBaseFor(mode: Mode) {
  if (mode === "abandoned") {
    return `I noticed you started an order but didn't complete payment.\n\nDo you still want it? I can help you complete it.`;
  }
  return `Thank you for buying from my myBizHub store.\n\nIf you need anything else or want to reorder, I'm available.`;
}

function fmtCountdown(msLeft: number) {
  const ms = Math.max(0, Math.floor(msLeft || 0));
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function cleanPlanKey(v: any): PlanKey {
  const k = String(v || "FREE").toUpperCase();
  return (k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE") as PlanKey;
}

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  return m.length > 140 ? fallback : m;
}

type RemixUsage = {
  cap: number;
  used: number;
  windowStartMs?: number;
  resetAtMs?: number;
};

export default function VendorReengagementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("buyers");

  const [segment, setSegment] = useState<ReengagementSegment>("buyers_all");
  const [days, setDays] = useState<number>(30);
  const [q, setQ] = useState("");

  const [people, setPeople] = useState<ReengagementPerson[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [baseText, setBaseText] = useState<string>(defaultBaseFor("buyers"));

  const [planKey, setPlanKey] = useState<PlanKey>("FREE");
  const [features, setFeatures] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);
  const [businessSlug, setBusinessSlug] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");

  const [counts, setCounts] = useState<Record<string, number>>({});

  const [rotationKey, setRotationKey] = useState<string>(() => `rot_${Date.now().toString(36)}`);

  const [autoRemixAfterCopy, setAutoRemixAfterCopy] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("bizhub_reengage_auto_remix");
      return v === "1";
    } catch {
      return false;
    }
  });

  const reengagementUnlocked = !!features?.reengagement;
  const smartGroupsOn = !!features?.reengagementSmartGroups;
  const smartMessagesOn = !!features?.reengagementSmartMessages;
  const aiRemixUnlocked = !!features?.reengagementAiRemix;
  const vipAllowed = cleanPlanKey(planKey) === "APEX" && aiRemixUnlocked;

  const [sending, setSending] = useState(false);
  const sendQueueRef = useRef<any[]>([]);
  const sendIdxRef = useRef<number>(0);

  const [remixUsage, setRemixUsage] = useState<RemixUsage | null>(null);
  const [remixInfo, setRemixInfo] = useState<any>(null);
  const [remixing, setRemixing] = useState(false);
  const [tick, setTick] = useState(0);

  // Step tracker for clear flow
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const selectedPeople = useMemo(() => people.filter((p) => selected[p.key]), [people, selected]);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please log in again to continue.");

    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "We couldn't complete that request.");
    return data;
  }

  async function loadAccess() {
    try {
      const data = await authedFetch("/api/vendor/access");
      const pk = String(data?.planKey || "FREE").toUpperCase() as PlanKey;

      setPlanKey(pk);
      setFeatures(data?.features || null);
      setLimits(data?.limits || null);

      setBusinessSlug(String(data?.business?.slug || ""));
      setBusinessName(String(data?.business?.name || ""));
    } catch {}
  }

  function currentSegment(): ReengagementSegment {
    if (mode === "abandoned") return "abandoned";
    if (!smartGroupsOn) return "buyers_all";
    if (segment === "vip" && !vipAllowed) return "buyers_all";
    return segment;
  }

  async function loadAudience() {
    setLoading(true);
    setMsg(null);

    try {
      const seg = currentSegment();

      const params = new URLSearchParams();
      params.set("segment", seg);
      // Always use a generous lookback for buyers to find all past orders
      if (seg === "abandoned") {
        params.set("days", String(days));
      } else {
        // Use 365 days lookback for buyers to capture all historical buyers
        params.set("days", "365");
      }
      if (q.trim()) params.set("q", q.trim());

      const data = await authedFetch(`/api/vendor/reengagement/audience?${params.toString()}`);

      const list = Array.isArray(data.people) ? (data.people as ReengagementPerson[]) : [];
      setPeople(list);

      setCounts(data?.counts || {});
      const initSel: Record<string, boolean> = {};
      for (const p of list.slice(0, 50)) initSel[String(p.key)] = true;
      setSelected(initSel);

      if (data?.meta?.planKey) setPlanKey(String(data.meta.planKey).toUpperCase() as PlanKey);
      if (data?.meta?.features) setFeatures(data.meta.features);
      if (data?.meta?.limits) setLimits(data.meta.limits);
    } catch (e: any) {
      const m = niceError(e, "Could not load audience. Please try again.");
      setMsg(m);
      setPeople([]);
      setSelected({});
      toast.error(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccess();
  }, []);

  useEffect(() => {
    setBaseText(defaultBaseFor(mode));
    if (mode === "abandoned") setSegment("buyers_all");
  }, [mode]);

  useEffect(() => {
    loadAudience();
  }, [mode, segment, days, smartGroupsOn, vipAllowed]);

  useEffect(() => {
    const t = setTimeout(() => loadAudience(), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const resetAtMs = Number(remixUsage?.resetAtMs || remixInfo?.resetAtMs || 0);
    if (!resetAtMs) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [remixUsage?.resetAtMs, remixInfo?.resetAtMs]);

  function toggle(key: string) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const p of people) next[String(p.key)] = on;
    setSelected(next);
  }

  async function requestRemix(opts?: { silent?: boolean }) {
    if (!aiRemixUnlocked) return;

    setRemixing(true);
    if (!opts?.silent) setMsg(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/vendor/reengagement/remix", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await r.json().catch(() => ({}));

      if (data?.ok) {
        const rk = String(data?.rotationKey || "").trim();
        if (rk) setRotationKey(rk);

        if (data?.usage) {
          setRemixUsage({
            cap: Number(data.usage.cap || 0),
            used: Number(data.usage.used || 0),
            windowStartMs: Number(data.usage.windowStartMs || 0) || 0,
            resetAtMs: Number(data.usage.resetAtMs || 0) || 0,
          });
        }

        setRemixInfo(null);
        if (!opts?.silent) toast.success("Message remixed.");
      } else {
        setRemixInfo(data || null);
        const m = String(data?.error || "Remix unavailable right now.");
        if (!opts?.silent) {
          setMsg(m);
          toast.info(m);
        }
      }
    } catch (e: any) {
      const m = niceError(e, "Could not remix message. Please try again.");
      if (!opts?.silent) {
        setMsg(m);
        toast.error(m);
      }
    } finally {
      setRemixing(false);
    }
  }

  async function copyForPerson(p: ReengagementPerson) {
    try {
      const seg = currentSegment();

      const text = smartMessagesOn
        ? composeSmartMessage({
            planKey,
            features: { reengagementSmartMessages: true, reengagementAiRemix: aiRemixUnlocked },
            businessSlug: businessSlug || null,
            businessName: businessName || null,
            segment: seg,
            baseText,
            person: p,
            rotationKey,
          })
        : baseText.trim();

      await navigator.clipboard.writeText(text);
      toast.success("Message copied!");
      if (aiRemixUnlocked && autoRemixAfterCopy) await requestRemix({ silent: true });
    } catch {
      toast.error("Couldn't copy the message.");
    }
  }

  async function startSend() {
    if (!baseText.trim()) return;
    if (selectedPeople.length === 0) return;

    setSending(true);
    setMsg(null);

    try {
      const seg = currentSegment();
      const recipients = selectedPeople.slice(0, 500);

      const data = await authedFetch("/api/vendor/reengagement/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: seg, baseText, rotationKey, people: recipients }),
      });

      const list: any[] = Array.isArray(data.recipients) ? data.recipients : [];
      if (list.length === 0) {
        const m = "No recipients available today (daily limit reached).";
        setMsg(m);
        toast.info(m);
        setSending(false);
        return;
      }

      sendQueueRef.current = list;
      sendIdxRef.current = 0;

      const tickSend = async () => {
        const i = sendIdxRef.current;
        const q2 = sendQueueRef.current;
        if (i >= q2.length) {
          setSending(false);
          toast.success("Done sending messages.");
          return;
        }
        const r = q2[i];
        window.open(waLink(String(r.phone || ""), String(r.text || baseText)), "_blank");
        sendIdxRef.current = i + 1;
        setTimeout(tickSend, 650);
      };

      tickSend();
    } catch (e: any) {
      setSending(false);
      const m = niceError(e, "Could not start sending. Please try again.");
      setMsg(m);
      toast.error(m);
    }
  }

  const seg = currentSegment();

  const segmentButtons: Array<{ key: ReengagementSegment; show: boolean }> = [
    { key: "buyers_all", show: true },
    { key: "buyers_first", show: smartGroupsOn },
    { key: "buyers_repeat", show: smartGroupsOn },
    { key: "inactive_30", show: smartGroupsOn },
    { key: "inactive_60", show: smartGroupsOn },
    { key: "inactive_90", show: smartGroupsOn },
    { key: "vip", show: vipAllowed },
  ];

  const selectedPreview = useMemo(() => {
    if (!selectedPeople.length) return null;
    const p = selectedPeople[0];
    const text = smartMessagesOn
      ? composeSmartMessage({
          planKey,
          features: { reengagementSmartMessages: true, reengagementAiRemix: aiRemixUnlocked },
          businessSlug: businessSlug || null,
          businessName: businessName || null,
          segment: seg,
          baseText,
          person: p,
          rotationKey,
        })
      : baseText.trim();
    return { p, text };
  }, [selectedPeople, smartMessagesOn, planKey, aiRemixUnlocked, businessSlug, businessName, seg, baseText, rotationKey]);

  const capResetAtMs = Number(remixUsage?.resetAtMs || remixInfo?.resetAtMs || 0);
  const countdownMs = capResetAtMs ? Math.max(0, capResetAtMs - Date.now()) : 0;
  const capReached = String(remixInfo?.code || "") === "REMIX_CAP_REACHED";

  const noPeople = !loading && people.length === 0;
  const noMatches = !loading && q.trim().length > 0 && people.length === 0;

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader
        title="Re-engagement"
        subtitle="Follow up with past buyers"
        showBack
        right={
          <button
            onClick={() => loadAudience()}
            disabled={loading}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("w-5 h-5 text-white", loading && "animate-spin")} />
          </button>
        }
      />

      <div className="px-4 space-y-4 pt-4 pb-48">
        {msg && (
          <Card className="p-4 bg-red-50 border-red-200">
            <p className="text-sm text-red-800">{msg}</p>
          </Card>
        )}

        {!reengagementUnlocked && !loading && (
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Upgrade required</p>
                <p className="text-xs text-gray-500 mt-1">
                  Re-engagement is available on Launch, Momentum, and Apex plans.
                </p>
                <Button size="sm" className="mt-3" onClick={() => router.push("/vendor/subscription")}
                  rightIcon={<ChevronRight className="w-4 h-4" />}>
                  View plans
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ═══════════════════ STEP 1: Select Audience ═══════════════════ */}
        <SectionCard
          title="Step 1: Select audience"
          subtitle="Choose who to message"
          right={
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold",
              selectedPeople.length > 0
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-gray-100 text-gray-500 border border-gray-200"
            )}>
              {selectedPeople.length} selected
            </span>
          }
        >
          <SegmentedControl<Mode>
            value={mode}
            onChange={(v) => {
              setMode(v);
              if (v === "abandoned") setSegment("buyers_all");
            }}
            options={[
              { value: "buyers", label: "Past buyers" },
              { value: "abandoned", label: "Abandoned orders" },
            ]}
          />

          {/* Segment filter pills (buyers mode) */}
          {mode === "buyers" && segmentButtons.filter((x) => x.show).length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {segmentButtons
                .filter((x) => x.show)
                .map(({ key }) => {
                  const active = segment === key;
                  const c = Number((counts as any)?.[key] || 0);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSegment(key)}
                      className={cn(
                        "px-3 py-2 rounded-2xl text-xs font-bold shrink-0 transition",
                        active
                          ? "text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                          : "border border-gray-200 bg-white text-gray-700 hover:border-orange-200"
                      )}
                    >
                      {segmentLabel(key)} {c ? `(${c})` : ""}
                    </button>
                  );
                })}
            </div>
          )}

          {/* Abandoned days selector */}
          {mode === "abandoned" && (
            <div className="mt-3">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Lookback period (days)</label>
              <Input
                type="number"
                placeholder="e.g. 30"
                min={7}
                max={365}
                value={String(days)}
                onChange={(e) => setDays(Number(e.target.value))}
                disabled={sending}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Orders started but not paid in the last {days} days
              </p>
            </div>
          )}

          {/* Search */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or phone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={sending}
              className="pl-10"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
              >
                <X className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="mt-3 flex items-center gap-3 py-4">
              <div className="h-5 w-5 rounded-full border-2 border-orange-300 border-t-transparent animate-spin" />
              <span className="text-sm text-gray-500">Loading audience...</span>
            </div>
          )}

          {/* Select all / clear */}
          {!loading && people.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {people.length} buyer{people.length !== 1 ? "s" : ""} found
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAll(true)}
                  disabled={sending}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700"
                >
                  Select all
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => toggleAll(false)}
                  disabled={sending}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* People list */}
          {!loading && people.length > 0 && (
            <div className="mt-2 space-y-1.5 max-h-[320px] overflow-y-auto">
              {people.map((p) => {
                const isSelected = !!selected[p.key];
                const name = String(p.fullName || "").trim() || "Unknown";
                const phone = String(p.phone || "").trim();
                const orderCount = Number(p.ordersCount || 0);
                const totalSpent = Number(p.totalSpent || 0);

                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggle(p.key)}
                    disabled={sending}
                    className={cn(
                      "w-full text-left rounded-2xl border p-3 transition",
                      isSelected
                        ? "border-orange-300 bg-orange-50/50 ring-1 ring-orange-100"
                        : "border-gray-100 bg-white hover:bg-gray-50/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected ? "border-orange-500 bg-orange-500" : "border-gray-300"
                      )}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {phone && <span>{phone}</span>}
                          {orderCount > 0 && <span> &bull; {orderCount} order{orderCount !== 1 ? "s" : ""}</span>}
                          {totalSpent > 0 && <span> &bull; {fmtNaira(totalSpent)}</span>}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty states */}
          {noPeople && !loading && (
            <Card className="p-5 mt-3 text-center" variant="soft">
              {noMatches ? (
                <>
                  <p className="text-sm font-bold text-gray-900">No matches</p>
                  <p className="text-xs text-gray-500 mt-1">Try a different search term.</p>
                  <Button variant="secondary" size="sm" className="mt-3" onClick={() => setQ("")}>
                    Clear search
                  </Button>
                </>
              ) : mode === "buyers" ? (
                <>
                  <div className="flex justify-center mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Users className="w-6 h-6 text-orange-500" />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-900">No buyers yet</p>
                  <p className="text-xs text-gray-500 mt-1.5 max-w-[260px] mx-auto leading-relaxed">
                    Buyers with paid or completed orders will appear here automatically.
                    Share your store link to start getting orders.
                  </p>
                  <div className="mt-4 flex gap-2 justify-center">
                    <Button variant="secondary" size="sm" onClick={() => router.push("/vendor/orders")}>
                      View orders
                    </Button>
                    <Button size="sm" onClick={() => router.push("/vendor/products")}>
                      View products
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-center mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-900">No abandoned orders</p>
                  <p className="text-xs text-gray-500 mt-1">
                    No unpaid orders found in the last {days} days.
                  </p>
                </>
              )}
            </Card>
          )}
        </SectionCard>

        {/* ═══════════════════ STEP 2: Write Message ═══════════════════ */}
        <SectionCard
          title="Step 2: Write your message"
          subtitle={smartMessagesOn ? "Personalized per buyer automatically" : "Same message for everyone"}
          right={
            aiRemixUnlocked ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => requestRemix()}
                disabled={sending || remixing || capReached}
                leftIcon={<Sparkles className="h-3.5 w-3.5" />}
              >
                {capReached ? "Limit" : remixing ? "..." : "Remix"}
              </Button>
            ) : null
          }
        >
          {capResetAtMs > 0 && (
            <p className="text-[11px] text-gray-500 mb-2 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Remix resets in: <b>{fmtCountdown(countdownMs)}</b>
            </p>
          )}

          <textarea
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 disabled:opacity-50 resize-none"
            placeholder="Write your message here..."
            value={baseText}
            onChange={(e) => setBaseText(e.target.value)}
            rows={5}
            disabled={sending}
          />

          {/* Preview */}
          {selectedPreview && (
            <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-600">Preview for: {selectedPreview.p.fullName || "Buyer"}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyForPerson(selectedPreview.p)}
                  leftIcon={<Copy className="h-3.5 w-3.5" />}
                  disabled={sending}
                >
                  Copy
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed">{selectedPreview.text}</pre>
            </div>
          )}

          {/* Safety notice — compact */}
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Harassment or offensive content will result in account suspension.
            </p>
          </div>
        </SectionCard>

        {/* ═══════════════════ STEP 3: Send ═══════════════════ */}
        {/* This is handled by the fixed bottom bar */}
      </div>

      {/* ═══════════════════ Fixed Bottom Send Bar ═══════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto w-full max-w-[430px] px-4 pb-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <Card className="p-4 shadow-lg border-gray-200">
            <Button
              onClick={startSend}
              disabled={!reengagementUnlocked || sending || !baseText.trim() || selectedPeople.length === 0}
              loading={sending}
              leftIcon={<MessageCircle className="h-4 w-4" />}
            >
              {sending
                ? "Sending..."
                : selectedPeople.length === 0
                ? "Select buyers to send"
                : `Send to ${selectedPeople.length} buyer${selectedPeople.length !== 1 ? "s" : ""}`}
            </Button>

            {limits?.reengagementDaily ? (
              <p className="text-[10px] text-gray-400 text-center mt-2">
                Daily limit: <b>{limits.reengagementDaily}</b> &bull; Selected: <b>{selectedPeople.length}</b>
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
