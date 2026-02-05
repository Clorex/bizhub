"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

import {
  RefreshCw,
  Link2,
  Store as StoreIcon,
  Plus,
  BarChart3,
  AlertTriangle,
  MessageCircle,
  Gem,
  BadgePercent,
  Shield,
  Sparkles,
  X,
  Bell,
} from "lucide-react";

type Range = "today" | "week" | "month";

type Nudge = {
  id: string;
  tone: "info" | "warn";
  title: string;
  body: string;
  cta?: { label: string; url: string };
};

const NUDGE_DISMISS_KEY = "mybizhub_dismissed_nudges_v1";
const PUSH_TOKEN_KEY = "mybizhub_push_token_v1";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function fmtDate(v: any) {
  try {
    if (!v) return "—";
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
    return String(v);
  } catch {
    return "—";
  }
}

function waShareLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function loadDismissed(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(NUDGE_DISMISS_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function saveDismissed(v: Record<string, number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NUDGE_DISMISS_KEY, JSON.stringify(v));
}

function getNotifPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export default function VendorDashboardPage() {
  const router = useRouter();

  const [range, setRange] = useState<Range>("week");
  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [assistant, setAssistant] = useState<any>(null);
  const [assistantMsg, setAssistantMsg] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dismissed, setDismissed] = useState<Record<string, number>>(() => loadDismissed());

  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushInfo, setPushInfo] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(PUSH_TOKEN_KEY);
  });

  // owner controls
  const viewerRole = String(data?.meta?.viewer?.role || "owner");
  const isOwner = viewerRole !== "staff";

  const [staffNudgesEnabled, setStaffNudgesEnabled] = useState<boolean>(!!data?.meta?.viewer?.staffNudgesEnabled);
  const [staffPushEnabled, setStaffPushEnabled] = useState<boolean>(!!data?.meta?.viewer?.staffPushEnabled);

  useEffect(() => {
    setPushPerm(getNotifPermission());
  }, []);

  const storeUrl = useMemo(() => {
    if (!me?.businessSlug) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/b/${me.businessSlug}`;
  }, [me]);

  async function load() {
    try {
      setLoading(true);
      setMsg(null);
      setNotice(null);
      setAssistantMsg(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await rMe.json().catch(() => ({}));
      if (!rMe.ok) throw new Error(meData?.error || "Failed to load profile");
      setMe(meData.me);

      const r = await fetch(`/api/vendor/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const a = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(a?.error || "Failed to load analytics");

      setData(a);
      setAccess(a?.meta?.access || null);

      setStaffNudgesEnabled(!!a?.meta?.viewer?.staffNudgesEnabled);
      setStaffPushEnabled(!!a?.meta?.viewer?.staffPushEnabled);

      const n = String(a?.meta?.notice || "");
      if (n) setNotice(n);

      const used = String(a?.meta?.usedRange || range) as Range;
      if (used !== range) setRange(used);

      // Assistant summary
      try {
        const ra = await fetch("/api/vendor/assistant/summary", { headers: { Authorization: `Bearer ${token}` } });
        const aj = await ra.json().catch(() => ({}));
        if (!ra.ok) throw new Error(aj?.error || aj?.code || "Assistant locked");
        setAssistant(aj);
      } catch (e: any) {
        setAssistant(null);
        const m = String(e?.message || "");
        if (m && !m.toLowerCase().includes("locked")) setAssistantMsg(m);
      }
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setData(null);
      setAccess(null);
      setAssistant(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function copyLink() {
    try {
      if (!storeUrl) return;
      await navigator.clipboard.writeText(storeUrl);
      alert("Store link copied");
    } catch {
      alert("Copy failed");
    }
  }

  function dismissNudge(id: string) {
    const next = { ...dismissed, [id]: Date.now() };
    setDismissed(next);
    saveDismissed(next);
  }

  async function updateStaffNotifSettings(next: { staffNudgesEnabled?: boolean; staffPushEnabled?: boolean }) {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      // store on business doc (simple)
      // NOTE: we update directly through firestore via an API route later if you want,
      // but for now keep it minimal: update using adminDb inside analytics route (already reads).
      // We will use a small API route for settings in the next step if you request.
      await fetch("/api/vendor/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Failed to update");
      });

      setPushInfo("Saved.");
      setTimeout(() => setPushInfo(null), 1200);
    } catch (e: any) {
      setPushInfo(e?.message || "Failed to update");
      setTimeout(() => setPushInfo(null), 1600);
    }
  }

  async function enablePush() {
    try {
      setPushBusy(true);
      setPushInfo(null);

      const perm = getNotifPermission();
      if (perm === "unsupported") {
        setPushInfo("Your browser does not support notifications.");
        return;
      }

      const granted = await Notification.requestPermission();
      setPushPerm(granted);

      if (granted !== "granted") {
        setPushInfo("Notifications not enabled.");
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase/client");

      const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        setPushInfo("Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY in env.");
        return;
      }

      const messaging = getMessaging(app);
      const fcmToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });

      if (!fcmToken) {
        setPushInfo("Could not get device token.");
        return;
      }

      await fetch("/api/vendor/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: fcmToken }),
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Register failed");
      });

      localStorage.setItem(PUSH_TOKEN_KEY, fcmToken);
      setPushToken(fcmToken);

      // foreground messages (when app open)
      onMessage(messaging, (payload) => {
        const title = payload?.notification?.title || "myBizHub";
        const body = payload?.notification?.body || "You have an update.";
        setPushInfo(`${title}: ${body}`);
        setTimeout(() => setPushInfo(null), 4000);
      });

      setPushInfo("Notifications enabled.");
      setTimeout(() => setPushInfo(null), 1500);
    } catch (e: any) {
      setPushInfo(e?.message || "Failed to enable notifications");
      setTimeout(() => setPushInfo(null), 2000);
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    try {
      setPushBusy(true);
      setPushInfo(null);

      const t = pushToken || (typeof window !== "undefined" ? localStorage.getItem(PUSH_TOKEN_KEY) : null);
      if (!t) {
        setPushInfo("Notifications already off.");
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      await fetch("/api/vendor/push/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: t }),
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Unregister failed");
      });

      localStorage.removeItem(PUSH_TOKEN_KEY);
      setPushToken(null);

      setPushInfo("Notifications disabled.");
      setTimeout(() => setPushInfo(null), 1500);
    } catch (e: any) {
      setPushInfo(e?.message || "Failed");
      setTimeout(() => setPushInfo(null), 2000);
    } finally {
      setPushBusy(false);
    }
  }

  const ov = data?.overview || {};
  const todo = data?.todo || {};
  const chartDays: any[] = Array.isArray(data?.chartDays) ? data.chartDays : [];
  const recentOrders: any[] = Array.isArray(data?.recentOrders) ? data.recentOrders : [];

  const checkin = data?.checkin || null;
  const checkinTitle = String(checkin?.title || "Daily business check‑in");
  const checkinLines: string[] = Array.isArray(checkin?.lines) ? checkin.lines.map(String) : [];
  const checkinSuggestion = String(checkin?.suggestion || "");

  const nudgesRaw: Nudge[] = Array.isArray(data?.nudges) ? data.nudges : [];
  const nudges = nudgesRaw.filter((n) => n?.id && !dismissed[n.id]).slice(0, 3);

  const maxRev = Math.max(1, ...chartDays.map((d) => Number(d.revenue || 0)));

  const monthUnlocked =
    access?.monthAnalyticsUnlocked !== undefined ? !!access.monthAnalyticsUnlocked : !!access?.features?.canUseMonthRange;

  const accessSource = String(access?.source || "free");
  const accessPlanKey = String(access?.planKey || "FREE").toUpperCase();
  const subscribed = accessSource === "subscription" && accessPlanKey !== "FREE";

  const disputeLevel = String(assistant?.dispute?.level || "none");
  const openDisputes = Number(assistant?.dispute?.openDisputes || 0);

  const riskShieldEnabled = assistant?.riskShield?.enabled === true;
  const riskShieldMode = String(assistant?.riskShield?.mode || "off");
  const riskNotes: string[] = Array.isArray(assistant?.riskShield?.notes) ? assistant.riskShield.notes : [];

  const momentumPlan = accessPlanKey === "MOMENTUM";

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Dashboard"
        subtitle="Your business overview"
        showBack={false}
        right={
          <div className="flex items-center gap-2">
            {!subscribed ? (
              <button
                type="button"
                onClick={() => router.push("/vendor/subscription")}
                className="h-10 w-10 rounded-2xl shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent flex items-center justify-center"
                aria-label="Upgrade"
                title="Upgrade"
              >
                <Gem className="h-5 w-5 text-white" />
              </button>
            ) : null}

            <IconButton aria-label="Refresh" onClick={load} disabled={loading}>
              <RefreshCw className="h-5 w-5 text-gray-700" />
            </IconButton>
          </div>
        }
      />

      <div className="px-4 pb-6 space-y-3">
        <SegmentedControl<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month", disabled: !monthUnlocked },
          ]}
        />

        {notice ? <Card className="p-4 text-orange-700">{notice}</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {pushInfo ? <Card className="p-4">{pushInfo}</Card> : null}

        {/* ✅ Push notifications */}
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-biz-ink">Notifications</p>
              <p className="text-xs text-biz-muted mt-1">
                Push alerts like OPay (new orders, important updates).
              </p>
              <p className="text-[11px] text-biz-muted mt-2">
                Status:{" "}
                <b className="text-biz-ink">
                  {pushPerm === "unsupported"
                    ? "Unsupported"
                    : pushPerm === "granted"
                      ? pushToken
                        ? "Enabled"
                        : "Allowed (not registered)"
                      : pushPerm}
                </b>
              </p>
            </div>

            <div className="shrink-0 h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center">
              <Bell className="h-5 w-5 text-orange-700" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={enablePush} disabled={pushBusy} loading={pushBusy}>
              Enable
            </Button>
            <Button variant="secondary" onClick={disablePush} disabled={pushBusy} loading={pushBusy}>
              Disable
            </Button>
          </div>

          {isOwner ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !staffNudgesEnabled;
                  setStaffNudgesEnabled(next);
                  updateStaffNotifSettings({ staffNudgesEnabled: next });
                }}
                className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink hover:bg-black/[0.02] transition"
              >
                Staff nudges: {staffNudgesEnabled ? "ON" : "OFF"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !staffPushEnabled;
                  setStaffPushEnabled(next);
                  updateStaffNotifSettings({ staffPushEnabled: next });
                }}
                className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink hover:bg-black/[0.02] transition"
              >
                Staff push: {staffPushEnabled ? "ON" : "OFF"}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-biz-muted">
              Staff push depends on what the owner allows.
            </p>
          )}
        </Card>

        {/* ✅ Smart Nudge Alerts */}
        {!loading && nudges.length ? (
          <Card className="p-4">
            <p className="text-sm font-extrabold text-biz-ink">Smart nudges</p>
            <p className="text-[11px] text-biz-muted mt-1">Small reminders. No noise.</p>

            <div className="mt-3 space-y-2">
              {nudges.map((n) => (
                <div key={n.id} className="rounded-2xl border border-biz-line bg-white p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={
                        n.tone === "warn"
                          ? "h-10 w-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0"
                          : "h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center shrink-0"
                      }
                    >
                      <Sparkles className="h-5 w-5 text-orange-700" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-biz-ink">{n.title}</p>
                      <p className="text-xs text-biz-muted mt-1">{n.body}</p>

                      <div className="mt-2 flex items-center gap-3">
                        {n.cta?.url ? (
                          <button
                            type="button"
                            onClick={() => router.push(n.cta!.url)}
                            className="text-xs font-bold text-orange-700 underline underline-offset-2"
                          >
                            {n.cta?.label || "Open"}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => dismissNudge(n.id)}
                          className="text-xs font-bold text-gray-500 inline-flex items-center gap-1"
                          aria-label="Dismiss"
                          title="Dismiss"
                        >
                          <X className="h-3.5 w-3.5" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* ✅ Daily Business Check‑in */}
        {!loading && checkin ? (
          <Card className="p-4 border border-biz-line bg-white">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-orange-700" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-biz-ink">{checkinTitle}</p>

                {checkinLines.length ? (
                  <div className="mt-2 space-y-1">
                    {checkinLines.slice(0, 4).map((t, i) => (
                      <p key={`${t}-${i}`} className="text-xs text-biz-muted">
                        • {t}
                      </p>
                    ))}
                  </div>
                ) : null}

                {checkinSuggestion ? (
                  <p className="mt-3 text-xs text-gray-700">
                    <b className="text-biz-ink">Suggestion:</b> {checkinSuggestion}
                  </p>
                ) : null}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                    View orders
                  </Button>
                  <Button variant="secondary" onClick={() => router.push("/vendor/products")}>
                    Products
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Dispute warning */}
        {!loading && assistant && disputeLevel !== "none" ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-biz-ink">Dispute warning</p>
                <p className="text-xs text-biz-muted mt-1">
                  You have <b className="text-biz-ink">{openDisputes}</b> open dispute(s). If ignored, your marketplace visibility reduces.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => router.push("/vendor/orders")}>View orders</Button>
                  <Button variant="secondary" onClick={() => router.push("/vendor/more")}>
                    More
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-biz-muted">Tip: update delivery progress and respond fast to prevent disputes.</p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Risk Shield (quiet monitoring) */}
        {!loading && assistant && String(accessPlanKey) === "MOMENTUM" ? (
          riskShieldEnabled ? (
            <Card className="p-4 border border-biz-line bg-white">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center">
                  <Shield className="h-5 w-5 text-orange-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-biz-ink">Risk Shield (quiet)</p>
                  <p className="text-[11px] text-biz-muted mt-1">
                    Monitoring enabled. You’ll see early warnings, but no action tools.
                    {riskShieldMode ? ` • Mode: ${riskShieldMode}` : ""}
                  </p>

                  {riskNotes.length ? (
                    <div className="mt-2 space-y-1">
                      {riskNotes.slice(0, 3).map((t: string) => (
                        <p key={t} className="text-[11px] text-gray-600">
                          • {t}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null
        ) : null}

        {!loading && data ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Total sales</p>
              <p className="text-2xl font-bold mt-1">{fmtNaira(ov.totalRevenue || 0)}</p>
              <p className="text-xs opacity-95 mt-1">
                Store: <b>{me?.businessSlug || "—"}</b>
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="soft"
                  className="bg-white/15 text-white border border-white/20"
                  leftIcon={<Link2 className="h-4 w-4" />}
                  onClick={copyLink}
                  disabled={!storeUrl}
                >
                  Copy link
                </Button>

                <Button
                  variant="soft"
                  className="bg-white/15 text-white border border-white/20"
                  leftIcon={<StoreIcon className="h-4 w-4" />}
                  onClick={() => router.push(`/b/${me?.businessSlug || ""}`)}
                  disabled={!me?.businessSlug}
                >
                  View store
                </Button>
              </div>
            </div>

            {assistant ? (
              <SectionCard
                title="Assistant"
                subtitle="Daily + weekly summary"
                right={
                  assistant?.meta?.limits?.canSendWhatsappSummary ? (
                    <button
                      className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-bold shadow-soft inline-flex items-center gap-2"
                      onClick={() => window.open(waShareLink(String(assistant.whatsappText || "")), "_blank")}
                    >
                      <MessageCircle className="h-4 w-4 text-gray-700" />
                      WhatsApp
                    </button>
                  ) : null
                }
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-[11px] text-biz-muted">Today</p>
                    <p className="text-sm font-bold text-biz-ink mt-1">{Number(assistant?.today?.orders || 0)} order(s)</p>
                    <p className="text-[11px] text-gray-500 mt-1">{fmtNaira(Number(assistant?.today?.revenue || 0))}</p>
                  </div>

                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-[11px] text-biz-muted">This week</p>
                    <p className="text-sm font-bold text-biz-ink mt-1">{Number(assistant?.week?.orders || 0)} order(s)</p>
                    <p className="text-[11px] text-gray-500 mt-1">{fmtNaira(Number(assistant?.week?.revenue || 0))}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => router.push("/vendor/products")}>
                    Share a product
                  </Button>
                  <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                    Manage orders
                  </Button>
                </div>
              </SectionCard>
            ) : assistantMsg ? (
              <Card className="p-4 text-red-700">{assistantMsg}</Card>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Orders" value={ov.orders || 0} onClick={() => router.push("/vendor/orders")} />
              <StatCard label="Products sold" value={ov.productsSold || 0} onClick={() => router.push("/vendor/orders")} />
              <StatCard label="Customers" value={ov.customers || 0} hint="Buyers (phone/email)" />
              <StatCard label="Website visits" value={ov.visits || 0} hint="Store + product views" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Leads (clicks)" value={ov.leads || 0} />
              <StatCard label="Views (impressions)" value={ov.views || 0} />
            </div>

            <SectionCard title="Sales trend" subtitle="Last 7 days">
              <div className="flex items-end gap-2 h-28">
                {chartDays.map((d) => {
                  const h = Math.max(6, Math.round((Number(d.revenue || 0) / maxRev) * 100));
                  return (
                    <div key={d.dayKey} className="flex-1 flex flex-col items-center justify-end gap-2">
                      <div
                        className="w-full rounded-xl bg-gradient-to-b from-biz-accent to-biz-accent2"
                        style={{ height: `${h}%` }}
                        title={`${d.label}: ₦${Number(d.revenue || 0).toLocaleString()}`}
                      />
                      <span className="text-[10px] text-gray-500">{String(d.label).slice(8, 10)}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Todo" subtitle="Quick fixes that improve sales">
              <div className="space-y-2 text-sm">
                <TodoRow label="Out of stock products" value={todo.outOfStockCount || 0} onClick={() => router.push("/vendor/products")} />
                <TodoRow label="Low stock products" value={todo.lowStockCount || 0} onClick={() => router.push("/vendor/products")} />
                <TodoRow label="Direct transfers awaiting confirmation" value={todo.awaitingConfirmCount || 0} onClick={() => router.push("/vendor/orders")} />
                <TodoRow label="Disputed orders" value={todo.disputedCount || 0} onClick={() => router.push("/vendor/orders")} />
              </div>
            </SectionCard>

            <SectionCard title="Quick actions" subtitle="Create, manage, and grow">
              <div className="grid grid-cols-2 gap-2">
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push("/vendor/products/new")}>
                  New listing
                </Button>
                <Button variant="secondary" leftIcon={<BarChart3 className="h-4 w-4" />} onClick={() => router.push("/vendor/analytics")}>
                  Analysis
                </Button>
                <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                  Orders
                </Button>
                <Button variant="secondary" onClick={() => router.push("/vendor/store")}>
                  Store settings
                </Button>

                <Button variant="secondary" className="col-span-2" leftIcon={<BadgePercent className="h-4 w-4" />} onClick={() => router.push("/vendor/discounts")}>
                  Sales
                </Button>
              </div>

              <p className="mt-3 text-[11px] text-biz-muted">
                Use the <b className="text-biz-ink">Gem</b> icon above to upgrade and unlock more tools.
              </p>
            </SectionCard>

            <SectionCard title="Recent orders" subtitle="Latest activity">
              {recentOrders.length === 0 ? (
                <div className="text-sm text-biz-muted">No orders yet.</div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.slice(0, 6).map((o) => (
                    <button
                      key={o.id}
                      className="w-full text-left rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition"
                      onClick={() => router.push(`/vendor/orders/${o.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-biz-ink">Order #{String(o.id).slice(0, 8)}</p>
                          <p className="text-xs text-biz-muted mt-1">
                            {o.paymentType || "—"} • {o.orderStatus || o.escrowStatus || "—"}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">Created: {fmtDate(o.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-biz-ink">{fmtNaira(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0))}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}

function TodoRow({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      className="w-full rounded-2xl border border-biz-line bg-white p-3 flex items-center justify-between hover:bg-black/[0.02] transition"
      onClick={onClick}
    >
      <span className="text-biz-ink">{label}</span>
      <span className="text-xs font-bold text-biz-ink">{value}</span>
    </button>
  );
}