"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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
    return `I noticed you started an order but didn’t complete payment.\n\nDo you still want it? I can help you complete it.`;
  }
  return `Thank you for buying from my BizHub store.\n\nIf you need anything else or want to reorder, I’m available.`;
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

function remixCapForPlan(planKey: PlanKey) {
  if (planKey === "LAUNCH") return 5;
  if (planKey === "MOMENTUM") return 25;
  if (planKey === "APEX") return Infinity;
  return 0;
}

function remixSuggestionForLocked(planKey: PlanKey) {
  if (planKey === "LAUNCH") {
    return {
      action: "buy_addon" as const,
      sku: "addon_reengage_remix_lite",
      title: "Buy Re‑engagement AI remix (lite)",
      url: "/vendor/purchases",
    };
  }
  if (planKey === "MOMENTUM") {
    return {
      action: "buy_addon" as const,
      sku: "addon_reengage_remix_apex_capped",
      title: "Buy Re‑engagement AI remix (Apex engine, capped)",
      url: "/vendor/purchases",
    };
  }
  return { action: "upgrade" as const, title: "Upgrade plan", url: "/vendor/subscription" };
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

  // ✅ AI remix is now purchasable on Launch/Momentum, core on Apex
  const aiRemixUnlocked = !!features?.reengagementAiRemix;

  // VIP remains APEX-only (requires AI remix too)
  const vipAllowed = cleanPlanKey(planKey) === "APEX" && aiRemixUnlocked;

  const [sending, setSending] = useState(false);
  const sendQueueRef = useRef<any[]>([]);
  const sendIdxRef = useRef<number>(0);

  // Remix cap UI state (rolling 24h)
  const [remixUsage, setRemixUsage] = useState<RemixUsage | null>(null);
  const [remixInfo, setRemixInfo] = useState<any>(null);
  const [remixing, setRemixing] = useState(false);
  const [tick, setTick] = useState(0);

  const selectedPeople = useMemo(() => people.filter((p) => selected[p.key]), [people, selected]);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
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
    } catch {
      // ignore
    }
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
      setMsg(e?.message || "Failed");
      setPeople([]);
      setSelected({});
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

      // Endpoint uses soft-block: HTTP 200 with ok:false
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
        if (!opts?.silent) setMsg("Remixed suggestions.");
      } else {
        setRemixInfo(data || null);
        if (data?.usage) {
          setRemixUsage({
            cap: Number(data.usage.cap || 0),
            used: Number(data.usage.used || 0),
            windowStartMs: Number(data.usage.windowStartMs || 0) || 0,
            resetAtMs: Number(data.usage.resetAtMs || 0) || 0,
          });
        }
        if (!opts?.silent) setMsg(String(data?.error || "Remix unavailable right now."));
      }
    } catch (e: any) {
      if (!opts?.silent) setMsg(e?.message || "Remix failed");
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

      setMsg(`Copied message for ${p.fullName || p.phone || "customer"}.`);

      // ✅ Regenerate consumes prompt
      if (aiRemixUnlocked && autoRemixAfterCopy) await requestRemix({ silent: true });
    } catch {
      setMsg("Copy failed.");
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
        body: JSON.stringify({
          segment: seg,
          baseText,
          rotationKey,
          people: recipients,
        }),
      });

      const list: any[] = Array.isArray(data.recipients) ? data.recipients : [];
      if (list.length === 0) {
        setMsg("No recipients available under your plan limit today.");
        setSending(false);
        return;
      }

      sendQueueRef.current = list;
      sendIdxRef.current = 0;

      const lim = data?.limit;
      setMsg(
        `Starting WhatsApp send… (${list.length} recipient(s))` +
          (lim?.remainingAfter != null ? ` • Remaining today: ${lim.remainingAfter}` : "")
      );

      const tickSend = async () => {
        const i = sendIdxRef.current;
        const q2 = sendQueueRef.current;

        if (i >= q2.length) {
          setSending(false);
          setMsg(`Done. Opened WhatsApp for ${q2.length} recipient(s).`);
          return;
        }

        const r = q2[i];
        const url = waLink(String(r.phone || ""), String(r.text || baseText));
        window.open(url, "_blank");

        sendIdxRef.current = i + 1;
        setTimeout(tickSend, 650);
      };

      tickSend();
    } catch (e: any) {
      setSending(false);
      setMsg(e?.message || "Failed");
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

  const remixCap = remixCapForPlan(cleanPlanKey(planKey));
  const capLabel =
    remixCap === Infinity ? "Unlimited" : remixCap > 0 ? `${remixCap} prompts / 24h` : "—";

  const capResetAtMs = Number(remixUsage?.resetAtMs || remixInfo?.resetAtMs || 0);
  const countdownMs = capResetAtMs ? Math.max(0, capResetAtMs - Date.now()) : 0;
  const capReached = String(remixInfo?.code || "") === "REMIX_CAP_REACHED";
  const remixLocked = String(remixInfo?.code || "") === "FEATURE_LOCKED";

  const lockedSuggestion = remixSuggestionForLocked(cleanPlanKey(planKey));
  const capSuggestion = remixInfo?.suggestion || null;

  return (
    <div className="min-h-screen">
      <GradientHeader title="Re‑engagement" subtitle="Message customers in smart groups" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {msg ? (
          <Card className={String(msg).toLowerCase().includes("blocked") ? "p-4 text-red-700" : "p-4"}>{msg}</Card>
        ) : null}

        {!reengagementUnlocked ? (
          <Card className="p-4">
            <p className="text-sm font-bold text-biz-ink">Upgrade required</p>
            <p className="text-xs text-biz-muted mt-1">Re‑engagement is available on paid plans.</p>
            <div className="mt-3">
              <Button onClick={() => (window.location.href = "/vendor/subscription")}>Upgrade</Button>
            </div>
          </Card>
        ) : null}

        <SectionCard title="Audience" subtitle="Choose who you want to message">
          <SegmentedControl<Mode>
            value={mode}
            onChange={(v) => {
              setMode(v);
              if (v === "abandoned") setSegment("buyers_all");
            }}
            options={[
              { value: "buyers", label: "Past buyers" },
              { value: "abandoned", label: "Not completed" },
            ]}
          />

          {mode === "abandoned" ? (
            <div className="mt-3">
              <Input
                type="number"
                min={7}
                max={365}
                value={String(days)}
                onChange={(e) => setDays(Number(e.target.value))}
                placeholder="30"
                disabled={sending}
              />
              <p className="text-[11px] text-biz-muted mt-1">Filters unpaid orders within the last X days.</p>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-[11px] text-biz-muted">
                {smartGroupsOn ? "Auto groups:" : "Auto groups are locked on your package."}
              </p>

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
            <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center border border-transparent">
              <Search className="h-5 w-5 text-orange-700" />
            </div>
            <Input placeholder="Search recipients…" value={q} onChange={(e) => setQ(e.target.value)} disabled={sending} />
            <Button
              variant="secondary"
              onClick={loadAudience}
              disabled={loading || sending}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => toggleAll(true)} disabled={sending}>
              Select all
            </Button>
            <Button variant="secondary" onClick={() => toggleAll(false)} disabled={sending}>
              Clear all
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Message"
          subtitle={
            smartMessagesOn
              ? aiRemixUnlocked
                ? cleanPlanKey(planKey) === "APEX"
                  ? "AI remix + unique per customer (Apex)"
                  : "AI remix (capped) + unique per customer"
                : "Unique per customer"
              : "Standard message (no smart personalization on your package)"
          }
          right={
            aiRemixUnlocked ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => requestRemix()}
                disabled={sending || remixing || capReached}
                leftIcon={<Sparkles className="h-4 w-4" />}
              >
                {capReached ? "Remix (limit)" : remixing ? "Remixing…" : "Remix"}
              </Button>
            ) : null
          }
        >
          {!aiRemixUnlocked && reengagementUnlocked && (cleanPlanKey(planKey) === "LAUNCH" || cleanPlanKey(planKey) === "MOMENTUM") ? (
            <Card variant="soft" className="p-3">
              <p className="text-sm font-bold text-biz-ink">AI remix locked</p>
              <p className="text-[11px] text-biz-muted mt-1">
                AI remix is not included on your plan by default. Buy the add-on to unlock it.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => router.push(lockedSuggestion.url)}>
                  Buy AI remix
                </Button>
                <Button size="sm" variant="secondary" onClick={() => router.push("/vendor/subscription")}>
                  Upgrade
                </Button>
              </div>
            </Card>
          ) : null}

          {aiRemixUnlocked ? (
            <Card className="p-3">
              <p className="text-sm font-bold text-biz-ink">AI remix usage</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Cap: <b className="text-biz-ink">{capLabel}</b>
                {remixUsage?.cap != null && Number.isFinite(remixUsage.cap) && remixUsage.cap > 0 ? (
                  <>
                    {" "}
                    • Used: <b className="text-biz-ink">{Number(remixUsage.used || 0)}</b> /{" "}
                    <b className="text-biz-ink">{Number(remixUsage.cap || 0)}</b>
                  </>
                ) : null}
              </p>

              {capResetAtMs ? (
                <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Resets in: <b className="text-biz-ink">{fmtCountdown(countdownMs)}</b>
                </p>
              ) : (
                <p className="text-[11px] text-gray-500 mt-1">
                  Timer starts after your first remix prompt.
                </p>
              )}

              {capReached ? (
                <div className="mt-2">
                  <p className="text-[11px] text-biz-muted">
                    You’ve hit your AI remix cap. You can still send messages—just wait for the timer to reset to remix again.
                  </p>
                  <div className="mt-2">
                    <Button size="sm" variant="secondary" onClick={() => router.push(String(capSuggestion?.url || "/vendor/subscription"))}>
                      Upgrade
                    </Button>
                  </div>
                </div>
              ) : null}

              {remixLocked ? (
                <div className="mt-2">
                  <Button size="sm" onClick={() => router.push(lockedSuggestion.url)}>
                    Buy AI remix
                  </Button>
                </div>
              ) : null}
            </Card>
          ) : null}

          <textarea
            className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
            value={baseText}
            onChange={(e) => setBaseText(e.target.value)}
            rows={7}
            disabled={sending}
          />

          {aiRemixUnlocked ? (
            <div className="mt-2 rounded-2xl border border-biz-line bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-biz-ink">Auto‑remix after copy</p>
                  <p className="text-[11px] text-biz-muted mt-1">
                    When you copy a customer message, we’ll remix the next one automatically. (Consumes prompts)
                  </p>
                </div>
                <button
                  type="button"
                  className={
                    autoRemixAfterCopy
                      ? "px-3 py-2 rounded-2xl text-xs font-bold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent"
                      : "px-3 py-2 rounded-2xl text-xs font-bold border border-biz-line bg-white"
                  }
                  onClick={() => {
                    const next = !autoRemixAfterCopy;
                    setAutoRemixAfterCopy(next);
                    try {
                      localStorage.setItem("bizhub_reengage_auto_remix", next ? "1" : "0");
                    } catch {}
                  }}
                  disabled={sending}
                >
                  {autoRemixAfterCopy ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          ) : null}

          {selectedPreview ? (
            <div className="mt-3 rounded-2xl border border-biz-line bg-white p-3">
              <p className="text-xs font-bold text-biz-ink">Preview (first selected)</p>
              <p className="text-[11px] text-biz-muted mt-1">
                {selectedPreview.p.fullName || selectedPreview.p.phone} • Last order:{" "}
                {selectedPreview.p.lastOrderMs ? fmtDate(Number(selectedPreview.p.lastOrderMs || 0)) : "—"}
              </p>
              <pre className="mt-2 whitespace-pre-wrap text-[12px] text-gray-800">{selectedPreview.text}</pre>
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyForPerson(selectedPreview.p)}
                  leftIcon={<Copy className="h-4 w-4" />}
                  disabled={sending}
                >
                  Copy this preview
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-2 rounded-2xl border border-biz-line bg-white p-3">
            <div className="flex items-start gap-2">
              <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-biz-ink">Safety policy</p>
                <p className="text-[11px] text-biz-muted mt-1">Bullying/sexual harassment content is blocked and logged.</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Recipients"
          subtitle={loading ? "Loading…" : `${people.length} found • ${selectedPeople.length} selected • ${segmentLabel(seg)}`}
        >
          {loading ? <p className="text-sm text-biz-muted">Loading…</p> : null}
          {!loading && people.length === 0 ? <p className="text-sm text-biz-muted">No recipients found.</p> : null}

          {!loading && people.length > 0 ? (
            <div className="space-y-2">
              {people.slice(0, 120).map((p) => {
                const on = !!selected[p.key];
                return (
                  <div key={p.key} className="rounded-2xl border border-biz-line bg-white p-3">
                    <button
                      className="w-full text-left"
                      onClick={() => (!sending ? toggle(p.key) : undefined)}
                      type="button"
                      disabled={sending}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-biz-ink">{p.fullName || p.phone || "Customer"}</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {p.phone || "—"} • Orders: <b>{Number(p.ordersCount || 0)}</b> • Last:{" "}
                            <b>{p.lastOrderMs ? fmtDate(Number(p.lastOrderMs || 0)) : "—"}</b>
                          </p>
                        </div>
                        <span
                          className={
                            on
                              ? "px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100"
                          }
                        >
                          {on ? "Selected" : "Off"}
                        </span>
                      </div>
                    </button>

                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyForPerson(p)}
                        disabled={sending}
                        leftIcon={<Copy className="h-4 w-4" />}
                      >
                        Copy message
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(waLink(String(p.phone || ""), selectedPreview?.text || baseText), "_blank")}
                        disabled={sending || !p.phone}
                      >
                        Open WhatsApp
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {people.length > 120 ? (
            <p className="mt-3 text-[11px] text-biz-muted">Showing first 120 to keep the page fast. Use search to find others.</p>
          ) : null}
        </SectionCard>

        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
            <Card className="p-4 space-y-2">
              <Button onClick={startSend} disabled={!reengagementUnlocked || sending || !baseText.trim() || selectedPeople.length === 0}>
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  {sending ? "Sending…" : "Send to selected"}
                </span>
              </Button>

              <Button variant="secondary" onClick={() => window.history.back()} disabled={sending}>
                Back
              </Button>

              {limits?.reengagementDaily ? (
                <p className="text-[11px] text-biz-muted text-center">
                  Daily limit: <b className="text-biz-ink">{limits.reengagementDaily}</b> (plan:{" "}
                  <b className="text-biz-ink">{planKey}</b>)
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