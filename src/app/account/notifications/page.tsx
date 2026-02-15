"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { Bell, BellRing, CheckCircle2, Loader2, XCircle } from "lucide-react";

type PushState = "loading" | "unsupported" | "denied" | "prompt" | "enabled";

function getPushState(): PushState {
  if (typeof window === "undefined") return "loading";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  const perm = Notification.permission;
  if (perm === "granted") {
    const token = localStorage.getItem("mybizhub_push_token_v1");
    return token ? "enabled" : "prompt";
  }
  if (perm === "denied") return "denied";
  return "prompt";
}

export default function CustomerNotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [pushState, setPushState] = useState<PushState>("loading");
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/account/login?redirect=/account/notifications");
        return;
      }
      setLoggedIn(true);
      setLoading(false);
      setPushState(getPushState());
    });
    return () => unsub();
  }, [router]);

  async function enablePush() {
    setEnabling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("denied");
        toast.info("Notifications were not enabled.");
        return;
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        toast.error("Please sign in again.");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        toast.error("Push configuration missing. Please contact support.");
        return;
      }

      toast.info("Setting up notifications...");

      const reg = await navigator.serviceWorker.register("/fcm-sw", { scope: "/fcm" });
      const { getMessaging, getToken } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase/client");
      const messaging = getMessaging(app);

      const fcmToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      });

      if (!fcmToken) {
        toast.error("Could not get notification token. Try again later.");
        return;
      }

      const r = await fetch("/api/vendor/push/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify({ token: fcmToken }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Registration failed");

      localStorage.setItem("mybizhub_push_token_v1", fcmToken);
      setPushState("enabled");
      toast.success("Push notifications enabled!");
    } catch (e: any) {
      console.error("Push enable error:", e);
      toast.error(e?.message || "Could not enable notifications.");
    } finally {
      setEnabling(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Notifications" subtitle="Stay updated" showBack />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Notifications" subtitle="Stay updated" showBack />
      <div className="px-4 pb-28 space-y-3">
        <Card className="p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-orange-400" />
          </div>
          <p className="text-base font-bold text-gray-900">No notifications yet</p>
          <p className="text-sm text-gray-500 mt-2 max-w-xs">
            When you receive order updates, promotions, or important alerts, they will appear here.
          </p>
        </Card>

        {/* Push notification status + action */}
        <Card className="p-4">
          <p className="text-sm font-extrabold text-gray-900 mb-3">Push notifications</p>

          {pushState === "enabled" && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-50 border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Notifications enabled</p>
                <p className="text-xs text-green-600 mt-0.5">
                  You will receive push notifications for order updates and alerts.
                </p>
              </div>
            </div>
          )}

          {pushState === "prompt" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Enable push notifications to get instant updates about your orders and important alerts.
              </p>
              <Button
                onClick={enablePush}
                loading={enabling}
                disabled={enabling}
                className="w-full"
                leftIcon={<BellRing className="w-4 h-4" />}
              >
                Enable push notifications
              </Button>
            </div>
          )}

          {pushState === "denied" && (
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-red-50 border border-red-200">
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Notifications blocked</p>
                <p className="text-xs text-red-600 mt-0.5">
                  You have blocked notifications for this site. To enable them, open your browser settings and allow notifications for this website.
                </p>
              </div>
            </div>
          )}

          {pushState === "unsupported" && (
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-200">
              <Bell className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-700">Not supported</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Push notifications are not supported on this browser or device. Try using Chrome or Edge on desktop or Android.
                </p>
              </div>
            </div>
          )}

          {pushState === "loading" && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
