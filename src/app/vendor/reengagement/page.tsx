// FILE: src/app/vendor/reengagement/page.tsx
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
import { MessageCircle, AlertTriangle, RefreshCw, Copy, Sparkles, Search, Clock } from "lucide-react";
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
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return "—";
  }
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
      if (seg === "abandoned") params.set("days", String(days));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setBaseText(defaultBaseFor(mode));
    if (mode === "abandoned") setSegment("buyers_all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    loadAudience();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, segment, days, smartGroupsOn, vipAllowed]);

  useEffect(() => {
    const t = setTimeout(() => loadAudience(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.success("Message copied to clipboard.");
      if (aiRemixUnlocked && autoRemixAfterCopy) await requestRemix({ silent: true });
    } catch {
      toast.error("Couldn't copy the message. Please copy it manually.");
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
    <div className="min-h-screen">
      <GradientHeader title="Re-engagement" subtitle="Follow up with past buyers" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!reengagementUnlocked ? (
          <Card className="p-4">
            <p className="text-sm font-bold text-biz-ink">Upgrade required</p>
            <p className="text-xs text-gray-500 mt-1">Re-engagement is available on Launch, Momentum, and Apex plans.</p>
            <div className="mt-3">
              <Button onClick={() => router.push("/vendor/subscription")}>Upgrade</Button>
            </div>
          </Card>
        ) : null}

        <SectionCard title="Audience" subtitle="Choose who to message">
          <SegmentedControl<Mode>
            value={mode}
            onChange={(v) => {
              setMode(v);
              if (v === "abandoned") setSegment("buyers_all");
            }}
            options={[
              { value: "buyers", label: "Past buyers" },
              { value: "abandoned", label: "Abandoned" },
            ]}
          />

          {mode === "abandoned" ? (
            <div className="mt-3">
              <Input
                type="number"
                placeholder="Last X days"
                min={7}
                max={365}
                value={String(days)}
                onChange={(e) => setDays(Number(e.target.value))}
                disabled={sending}
              />
              <p className="text-[11px] text-biz-muted mt-2">Show orders that started but weren't paid in the last {days} days.</p>
            </div>
          ) : (
            <div className="mt-3">
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
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
                        className={
                          active
                            ? "px-3 py-2 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shrink-0"
                            : "px-3 py-2 rounded-2xl text-xs font-extrabold border border-biz-line bg-white shrink-0"
                        }
                      >
                        {segmentLabel(key)} {c ? `(${c})` : ""}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center border border-transparent shrink-0">
              <Search className="h-5 w-5 text-orange-700" />
            </div>
            <Input placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} disabled={sending} />
            <Button variant="secondary" onClick={loadAudience} disabled={loading || sending} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => toggleAll(true)} disabled={sending || people.length === 0}>
              Select all
            </Button>
            <Button variant="secondary" onClick={() => toggleAll(false)} disabled={sending || people.length === 0}>
              Clear
            </Button>
          </div>

          {noPeople ? (
            <Card variant="soft" className="p-4 mt-3">
              {noMatches ? (
                <>
                  <p className="text-sm font-extrabold text-biz-ink">No matches</p>
                  <p className="text-xs text-gray-500 mt-1">Try a different search term.</p>
                  <div className="mt-3">
                    <Button variant="secondary" onClick={() => setQ("")}>
                      Clear search
                    </Button>
                  </div>
                </>
              ) : mode === "buyers" ? (
                <>
                  <p className="text-sm font-extrabold text-biz-ink">No buyers yet</p>
                  <p className="text-xs text-gray-500 mt-1">After your first order, buyers will show here.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                      Orders
                    </Button>
                    <Button variant="secondary" onClick={() => router.push("/vendor/products/new")}>
                      Add product
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-extrabold text-biz-ink">No abandoned orders</p>
                  <p className="text-xs text-gray-500 mt-1">Nothing to follow up right now.</p>
                  <div className="mt-3">
                    <Button variant="secondary" onClick={loadAudience}>
                      Refresh
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Message"
          subtitle={smartMessagesOn ? "Personalized per buyer" : "Same message for everyone"}
          right={
            aiRemixUnlocked ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => requestRemix()}
                disabled={sending || remixing || capReached}
                leftIcon={<Sparkles className="h-4 w-4" />}
              >
                {capReached ? "Limit reached" : remixing ? "Remixing…" : "Remix"}
              </Button>
            ) : null
          }
        >
          {capResetAtMs ? (
            <p className="text-[11px] text-gray-500 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Remix resets in: <b className="text-biz-ink">{fmtCountdown(countdownMs)}</b>
            </p>
          ) : null}

          <textarea
            className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40 disabled:opacity-50"
            placeholder="Write your message here…"
            value={baseText}
            onChange={(e) => setBaseText(e.target.value)}
            rows={7}
            disabled={sending}
          />

          {selectedPreview ? (
            <div className="mt-3 rounded-2xl border border-biz-line bg-white p-3">
              <p className="text-xs font-bold text-biz-ink">Preview (first selected buyer)</p>
              <pre className="mt-2 whitespace-pre-wrap text-[12px] text-gray-800">{selectedPreview.text}</pre>
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyForPerson(selectedPreview.p)}
                  leftIcon={<Copy className="h-4 w-4" />}
                  disabled={sending}
                >
                  Copy
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-2 rounded-2xl border border-biz-line bg-white p-3">
            <div className="flex items-start gap-2">
              <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-biz-ink">Safety policy</p>
                <p className="text-[11px] text-gray-500 mt-1">Bullying, harassment, or offensive content is blocked and may result in account suspension.</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
            <Card className="p-4 space-y-2">
              <Button
                onClick={startSend}
                disabled={!reengagementUnlocked || sending || !baseText.trim() || selectedPeople.length === 0}
                leftIcon={<MessageCircle className="h-4 w-4" />}
              >
                {sending ? "Sending…" : `Send to ${selectedPeople.length} buyer${selectedPeople.length !== 1 ? "s" : ""}`}
              </Button>

              <Button variant="secondary" onClick={() => router.back()} disabled={sending}>
                Back
              </Button>

              {limits?.reengagementDaily ? (
                <p className="text-[11px] text-gray-500 text-center">
                  Daily limit: <b className="text-biz-ink">{limits.reengagementDaily}</b> • Selected: <b className="text-biz-ink">{selectedPeople.length}</b>
                </p>
              ) : null}
            </Card>
          </div>
        </div>

        <div className="h-28" />
      </div>
    </div>
  );
}