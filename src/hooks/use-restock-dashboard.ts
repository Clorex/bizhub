// FILE: src/hooks/use-restock-dashboard.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase/client";
import type { RestockDashboardData } from "@/types/restock";

interface UseRestockDashboardReturn {
  data: RestockDashboardData | null;
  isLoading: boolean;
  error: string | null;
  isApexRequired: boolean;
  upsell: { title: string; description: string; cta: string } | null;
  refetch: () => void;
  dismissFlag: (flagId: string) => Promise<void>;
}

export function useRestockDashboard(): UseRestockDashboardReturn {
  const [data, setData] = useState<RestockDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApexRequired, setIsApexRequired] = useState(false);
  const [upsell, setUpsell] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsApexRequired(false);
    setUpsell(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("Please log in.");
        return;
      }

      const res = await fetch("/api/vendor/restock/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 403 && json.code === "APEX_REQUIRED") {
        setIsApexRequired(true);
        setUpsell(json.upsell || null);
        setData(null);
        return;
      }

      if (!res.ok || !json.ok) {
        setError(json.error || "Failed to load restock data.");
        setData(null);
        return;
      }

      setData(json.data);
    } catch (err: any) {
      setError(err?.message || "Network error.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dismissFlag = useCallback(async (flagId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      await fetch("/api/vendor/restock/dismiss", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ flagId }),
      });

      // Optimistic remove
      setData((prev) => {
        if (!prev) return prev;
        const removeFlag = (items: typeof prev.risk_products) =>
          items
            .map((item) => ({
              ...item,
              flags: item.flags.filter((f) => f.id !== flagId),
            }))
            .filter((item) => item.flags.length > 0);

        return {
          ...prev,
          risk_products: removeFlag(prev.risk_products),
          rising_demand_products: removeFlag(prev.rising_demand_products),
          needs_attention_products: removeFlag(prev.needs_attention_products),
          total_active_flags: Math.max(0, prev.total_active_flags - 1),
        };
      });
    } catch {
      // Silently fail, will sync on next refresh
    }
  }, []);

  return { data, isLoading, error, isApexRequired, upsell, refetch: fetchData, dismissFlag };
}
