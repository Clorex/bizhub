"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Card } from "@/components/Card";
import { Bell, X } from "lucide-react";
import { auth } from "@/lib/firebase/client";

const PUSH_TOKEN_KEY = "mybizhub_push_token_v1";
const PUSH_SNOOZE_UNTIL_KEY = "mybizhub_push_snooze_until_ms_v1";
const PUSH_LAST_PROMPT_KEY = "mybizhub_push_last_prompt_ms_v1";

function ms() {
  return Date.now();
}

function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function getPerm(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function loadNum(key: string, fallback = 0) {
  if (typeof window === "undefined") return fallback;
  const v = Number(localStorage.getItem(key) || 0);
  return Number.isFinite(v) ? v : fallback;
}

function saveNum(key: string, v: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, String(v));
}

export default function PushBellFloating() {
  const pathname = usePathname() || "/";
  const onVendor = pathname.startsWith("/vendor");

  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const [tokenLocal, setTokenLocal] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(PUSH_TOKEN_KEY);
  });

  // small random reminder banner
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    setPerm(getPerm());
  }, []);

  const isEnabled = perm === "granted" && !!tokenLocal;

  const statusText = useMemo(() => {
    if (perm === "unsupported") return "Not supported on this browser";
    if (perm === "denied") return "Blocked";
    if (perm === "default") return "Not enabled";
    return tokenLocal ? "Enabled" : "Allowed (not registered)";
  }, [perm, tokenLocal]);

  function snoozeRandom() {
    // next reminder between 6 hours and 36 hours
    const next = ms() + randInt(6, 36) * 3600_000;
    saveNum(PUSH_SNOOZE_UNTIL_KEY, next);
    saveNum(PUSH_LAST_PROMPT_KEY, ms());
  }

  // ✅ Auto popup when entering the app (vendor pages)
  useEffect(() => {
    if (!onVendor) return;
    if (typeof window === "undefined") return;

    const p = getPerm();
    setPerm(p);

    // if already enabled, do nothing
    if (p === "granted" && localStorage.getItem(PUSH_TOKEN_KEY)) return;

    // respect snooze
    const snoozeUntil = loadNum(PUSH_SNOOZE_UNTIL_KEY, 0);
    if (snoozeUntil && ms() < snoozeUntil) return;

    // don't spam: at most once every 12 hours
    const lastPrompt = loadNum(PUSH_LAST_PROMPT_KEY, 0);
    if (lastPrompt && ms() - lastPrompt < 12 * 3600_000) return;

    // open auto prompt
    setOpen(true);
    saveNum(PUSH_LAST_PROMPT_KEY, ms());
  }, [onVendor, pathname]);

  // ✅ Random reminders from time to time on different pages
  useEffect(() => {
    if (!onVendor) return;
    if (typeof window === "undefined") return;

    const p = getPerm();
    if (p === "granted" && localStorage.getItem(PUSH_TOKEN_KEY)) return;
    if (p === "denied") return; // can't help

    const snoozeUntil = loadNum(PUSH_SNOOZE_UNTIL_KEY, 0);
    if (snoozeUntil && ms() < snoozeUntil) return;

    // small chance per page visit
    const chance = 0.22; // 22%
    if (Math.random() < chance) {
      const t = setTimeout(() => setReminderOpen(true), randInt(1200, 4000));
      return () => clearTimeout(t);
    }
  }, [onVendor, pathname]);

  async function enable() {
    try {
      setBusy(true);
      setInfo(null);

      const p = getPerm();
      if (p === "unsupported") {
        setInfo("Notifications are not supported on this browser.");
        return;
      }

      if (!window.isSecureContext) {
        setInfo("Notifications require HTTPS.");
        return;
      }

      const granted = await Notification.requestPermission();
      setPerm(granted);

      if (granted !== "granted") {
        setInfo("No problem. You can turn it on later.");
        snoozeRandom();
        return;
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setInfo("Please log in again.");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        setInfo("Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY in env.");
        return;
      }

      // ✅ Dedicated FCM SW scope
      const reg = await navigator.serviceWorker.register("/fcm-sw", { scope: "/fcm" });

      const { getMessaging, getToken } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase/client");
      const messaging = getMessaging(app);

      const fcmToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      });

      if (!fcmToken) {
        setInfo("Could not enable notifications on this device.");
        snoozeRandom();
        return;
      }

      const r = await fetch("/api/vendor/push/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token: fcmToken }),
      });

      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to register device");

      localStorage.setItem(PUSH_TOKEN_KEY, fcmToken);
      setTokenLocal(fcmToken);

      // clear snooze
      saveNum(PUSH_SNOOZE_UNTIL_KEY, 0);

      setInfo("Done. Notifications are on.");
      setTimeout(() => {
        setInfo(null);
        setOpen(false);
        setReminderOpen(false);
      }, 800);
    } catch (e: any) {
      setInfo(e?.message || "Failed to enable notifications");
      snoozeRandom();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    try {
      setBusy(true);
      setInfo(null);

      const local = tokenLocal || (typeof window !== "undefined" ? localStorage.getItem(PUSH_TOKEN_KEY) : null);
      if (!local) {
        setInfo("Already off on this device.");
        snoozeRandom();
        return;
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setInfo("Please log in again.");
        return;
      }

      const r = await fetch("/api/vendor/push/unregister", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token: local }),
      });

      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to disable");

      localStorage.removeItem(PUSH_TOKEN_KEY);
      setTokenLocal(null);

      // schedule reminders later (random)
      snoozeRandom();

      setInfo("Notifications turned off.");
      setTimeout(() => {
        setInfo(null);
        setOpen(false);
      }, 900);
    } catch (e: any) {
      setInfo(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  // If not vendor pages, do nothing
  if (!onVendor) return null;

  return (
    <>
      {/* small floating bell (optional access to disable / status) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-36 right-4 z-[65] rounded-2xl border border-biz-line bg-white shadow-float px-3 py-3 inline-flex items-center gap-2"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-5 w-5 text-orange-700" />
        <span className="text-sm font-extrabold text-biz-ink">{isEnabled ? "Notify" : "Turn on alerts"}</span>
      </button>

      {/* Random reminder banner */}
      {reminderOpen && !isEnabled ? (
        <div className="fixed bottom-28 left-0 right-0 z-[68] px-4">
          <Card className="p-3 max-w-xl mx-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-biz-ink">Turn on notifications</p>
                <p className="text-xs text-biz-muted mt-1">So you don’t miss new orders and important updates.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReminderOpen(false);
                  snoozeRandom();
                }}
                className="h-9 w-9 rounded-2xl border border-biz-line bg-white inline-flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-gray-700" />
              </button>
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={enable}
                disabled={busy}
                className="w-full rounded-2xl bg-orange-600 text-white py-3 text-sm font-extrabold disabled:opacity-50"
              >
                {busy ? "Please wait…" : "Enable notifications"}
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Main modal (auto pops sometimes on entry) */}
      {open ? (
        <div className="fixed inset-0 z-[75] bg-black/40 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-xl">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-biz-ink">Notifications</p>
                  <p className="text-[11px] text-biz-muted mt-1">Get alerts outside the app (new orders, reminders).</p>
                  <p className="text-[11px] text-biz-muted mt-2">
                    Status: <b className="text-biz-ink">{statusText}</b>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!isEnabled) snoozeRandom();
                  }}
                  className="h-10 w-10 rounded-2xl border border-biz-line bg-white inline-flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-gray-700" />
                </button>
              </div>

              {info ? <p className="mt-3 text-sm text-orange-700">{info}</p> : null}

              {/* ✅ One main action (no two big buttons) */}
              {!isEnabled ? (
                <>
                  <button
                    type="button"
                    onClick={enable}
                    disabled={busy}
                    className="mt-3 w-full rounded-2xl bg-orange-600 text-white py-3 text-sm font-extrabold disabled:opacity-50"
                  >
                    {busy ? "Please wait…" : "Enable notifications"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      snoozeRandom();
                    }}
                    className="mt-2 w-full rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink"
                  >
                    Not now
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={disable}
                  disabled={busy}
                  className="mt-3 w-full rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink disabled:opacity-50"
                >
                  {busy ? "Please wait…" : "Disable notifications on this device"}
                </button>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}