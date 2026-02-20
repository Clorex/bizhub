// FILE: src/hooks/use-product-insight.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase/client";
import type { ProductInsightDetail } from "@/types/restock";

export function useProductInsight(productId: string | null) {
  const [data, setData] = useState<ProductInsightDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!productId) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("Please log in.");
        return;
      }

      const res = await fetch(
        `/api/vendor/restock/product?productId=${encodeURIComponent(productId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        setError(json.error || "Failed to load product insights.");
        setData(null);
        return;
      }

      setData(json.data);
    } catch (err: any) {
      setError(err?.message || "Network error.");
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
