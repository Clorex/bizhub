// FILE: src/hooks/use-intent-radar.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase/client";
import type { IntentRadarDashboardData } from "@/types/buyer-intent";

export function useIntentRadar() {
  const [data, setData] = useState<IntentRadarDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApexRequired, setIsApexRequired] = useState(false);
  const [upsell, setUpsell] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsApexRequired(false);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setError("Please log in."); return; }

      const res = await fetch("/api/vendor/intent-radar/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 403 && json.code === "APEX_REQUIRED") {
        setIsApexRequired(true);
        setUpsell(json.upsell || null);
        return;
      }

      if (!res.ok || !json.ok) {
        setError(json.error || "Failed.");
        return;
      }

      setData(json.data);
    } catch (err: any) {
      setError(err?.message || "Network error.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error, isApexRequired, upsell, refetch: fetchData };
}
