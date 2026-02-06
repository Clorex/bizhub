"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { Bell, X } from "lucide-react";
import { auth } from "@/lib/firebase/client";

const PUSH_TOKEN_KEY = "mybizhub_push_token_v1";

function getPerm(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export default function PushBellFloating() {
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const [tokenLocal, setTokenLocal] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(PUSH_TOKEN_KEY);
  });

  useEffect(() => {
    setPerm(getPerm());
  }, []);

  const statusText = useMemo(() => {
    if (perm === "unsupported") return "Not supported on this browser";
    if (perm === "denied") return "Blocked";
    if (perm === "default") return "Not enabled yet";
    // granted
    return tokenLocal ? "Enabled" : "Allowed (not registered)";
  }, [perm, tokenLocal]);

  async function enable() {
    try {
      setBusy(true);
      setInfo(null);

      const p = getPerm();
      if (p === "unsupported") {
        setInfo("Notifications are not supported on this browser.");
        return;
      }

      const granted = await Notification.requestPermission();
      setPerm(granted);

      if (granted !== "granted") {
        setInfo("Notifications were not enabled.");
        return;
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setInfo("Please log in again.");
        return;
      }

      // ✅ IMPORTANT: Use existing service worker registration (your PWA SW)
      // Do NOT try to register /firebase-messaging-sw.js (it caused 404 for you)
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) {
        setInfo("Service worker not ready yet. Refresh this page and try again.");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        setInfo("Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY in env.");
        return;
      }

      const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase/client");

      const messaging = getMessaging(app);

      const fcmToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      });

      if (!fcmToken) {
        setInfo("Could not get device token.");
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

      // Foreground messages (when app is open)
      onMessage(messaging, (payload) => {
        const t = payload?.notification?.title || "myBizHub";
        const b = payload?.notification?.body || "You have an update.";
        setInfo(`${t}: ${b}`);
        setTimeout(() => setInfo(null), 3500);
      });

      setInfo("Notifications enabled.");
      setTimeout(() => setInfo(null), 1500);
      setOpen(false);
    } catch (e: any) {
      setInfo(e?.message || "Failed to enable notifications");
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
        setInfo("Notifications are already off.");
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

      setInfo("Notifications disabled.");
      setTimeout(() => setInfo(null), 1200);
      setOpen(false);
    } catch (e: any) {
      setInfo(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating bell */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-36 right-4 z-[65] rounded-2xl border border-biz-line bg-white shadow-float px-3 py-3 inline-flex items-center gap-2"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-5 w-5 text-orange-700" />
        <span className="text-sm font-extrabold text-biz-ink">Notify</span>
      </button>

      {/* Modal */}
      {open ? (
        <div className="fixed inset-0 z-[75] bg-black/40 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-xl">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-biz-ink">Notifications</p>
                  <p className="text-[11px] text-biz-muted mt-1">
                    Get push alerts outside the app (new orders, reminders).
                  </p>
                  <p className="text-[11px] text-biz-muted mt-2">
                    Status: <b className="text-biz-ink">{statusText}</b>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 w-10 rounded-2xl border border-biz-line bg-white inline-flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-gray-700" />
                </button>
              </div>

              {info ? <p className="mt-3 text-sm text-orange-700">{info}</p> : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={enable}
                  disabled={busy}
                  className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink disabled:opacity-50"
                >
                  {busy ? "Please wait…" : "Enable"}
                </button>

                <button
                  type="button"
                  onClick={disable}
                  disabled={busy}
                  className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink disabled:opacity-50"
                >
                  {busy ? "Please wait…" : "Disable"}
                </button>
              </div>

              <p className="mt-3 text-[11px] text-biz-muted">
                Note: If you blocked notifications before, allow them in your browser settings and try again.
              </p>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}