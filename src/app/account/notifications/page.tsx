"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { Bell, Loader2 } from "lucide-react";

export default function CustomerNotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/account/login?redirect=/account/notifications");
        return;
      }
      setLoggedIn(true);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

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

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Push notifications</p>
          <p className="text-xs text-biz-muted mt-1">
            To receive push notifications, tap the bell icon that appears at the bottom-right of the screen and allow notifications in your browser.
          </p>
        </Card>
      </div>
    </div>
  );
}
