"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Card } from "@/components/Card";
import { X } from "lucide-react";
import { auth } from "@/lib/firebase/client";

const PUSH_TOKEN_KEY = "mybizhub_push_token_v1";
const PUSH_SNOOZE_UNTIL_KEY = "mybizhub_push_snooze_until_ms_v2";
const PUSH_LAST_PROMPT_KEY = "mybizhub_push_last_prompt_ms_v2";

function now() {
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

function snoozeLater() {
  // next appearance between 6 hours and 36 hours
  const next = now() + randInt(6, 36) * 3600_000;
  saveNum(PUSH_SNOOZE_UNTIL_KEY, next);
  saveNum(PUSH_LAST_PROMPT_KEY, now());
}

export default function PushBellFloating() {
  const pathname = usePathname() || "/";
  const onVendor = pathname.startsWith("/vendor"); // show prompts only in vendor app

  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const [tokenLocal, setTokenLocal] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(PUSH_TOKEN_KEY);
  });

  const enabled = useMemo(() => perm === "granted" && !!tokenLocal, [perm, tokenLocal]);

  useEffect(() => {
    setPerm(getPerm());
  }, []);

  // ✅ Auto prompt on entry (but not spam)
  useEffect(() => {
    if (!onVendor) return;
    if (typeof window === "undefined") return;

    const p = getPerm();
    setPerm(p);

    // if enabled already, never show again
    if (p === "granted" && localStorage.getItem(PUSH_TOKEN_KEY)) return;

    // if blocked, don't show (nothing we can do)
    if (p === "denied") return;

    // respect snooze
    const snoozeUntil = loadNum(PUSH_SNOOZE_UNTIL_KEY, 0);
    if (snoozeUntil && now() < snoozeUntil) return;

    // not more than once every 12 hours
    const lastPrompt = loadNum(PUSH_LAST_PROMPT_KEY, 0);
    if (lastPrompt && now() - lastPrompt < 12 * 3600_000) return;

    // show after a short delay so it feels smooth
    const t = setTimeout(() => {
      setOpen(true);
      saveNum(PUSH_LAST_PROMPT_KEY, now());
    }, randInt(900, 2200));

    return () => clearTimeout(t);
  }, [onVendor, pathname]);

  // ✅ Random “come back later” prompts on other pages
  useEffect(() => {
    if (!onVendor) return;
    if (typeof window === "undefined") return;

    const p = getPerm();
    if (p === "granted" && localStorage.getItem(PUSH_TOKEN_KEY)) return;
    if (p === "denied") return;

    const snoozeUntil = loadNum(PUSH_SNOOZE_UNTIL_KEY, 0);
    if (snoozeUntil && now() < snoozeUntil) return;

    // chance per page visit
    const chance = 0.18; // 18%
    if (Math.random() < chance) {
      const t = setTimeout(() => {
        setOpen(true);
        saveNum(PUSH_LAST_PROMPT_KEY, now());
      }, randInt(1200, 4500));
      return () => clearTimeout(t);
    }
  }, [onVendor, pathname]);

  async function enableNotifications() {
    try {
      setBusy(true);
      setInfo(null);

      const p = getPerm();
      if (p === "unsupported") {
        setInfo("Notifications are not supported on this browser.");
        snoozeLater();
        return;
      }

      const granted = await Notification.requestPermission();
      setPerm(granted);

      if (granted !== "granted") {
        // user chose Not allowed / dismissed
        setOpen(false);
        snoozeLater();
        return;
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setInfo("Please log in again.");
        snoozeLater();
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        setInfo("Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY in env.");
        snoozeLater();
        return;
      }

      // ✅ FCM SW route (must exist): src/app/fcm-sw/route.ts
      const reg = await navigator.serviceWorker.register("/fcm-sw", { scope: "/fcm" });

      const { getMessaging, getToken } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase/client");
      const messaging = getMessaging(app);

      const fcmToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      });

      if (!fcmToken) {
        setInfo("Could not enable on this device. Try again later.");
        snoozeLater();
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

      // clear snooze so it never returns
      saveNum(PUSH_SNOOZE_UNTIL_KEY, 0);

      // ✅ disappears completely after enable
      setOpen(false);
      setInfo(null);
    } catch (e: any) {
      setInfo(e?.message || "Failed to enable notifications");
      snoozeLater();
    } finally {
      setBusy(false);
    }
  }

  // If already enabled OR not in vendor area, render nothing
  if (!onVendor) return null;
  if (enabled) return null;

  return open ? (
    <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px] flex items-end justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-4 rounded-[26px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-biz-ink">Turn on notifications</p>
              <p className="text-xs text-biz-muted mt-1">
                So you don’t miss new orders and important updates.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                snoozeLater();
              }}
              className="h-10 w-10 rounded-2xl border border-biz-line bg-white inline-flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-gray-700" />
            </button>
          </div>

          {info ? <p className="mt-3 text-sm text-orange-700">{info}</p> : null}

          <div className="mt-3">
            <button
              type="button"
              onClick={enableNotifications}
              disabled={busy}
              className="w-full rounded-2xl bg-black text-white py-3 text-sm font-extrabold disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Enable notifications"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                snoozeLater();
              }}
              className="mt-2 w-full rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink"
            >
              Not now
            </button>
          </div>

          <p className="mt-3 text-[11px] text-biz-muted">
            You can turn it on later. We’ll remind you sometimes.
          </p>
        </Card>
      </div>
    </div>
  ) : null;
}