"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    // Keep SW OFF during editing/dev to avoid cache confusion
    if (process.env.NODE_ENV !== "production") return;

    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // ignore
      }
    };

    register();
  }, []);

  return null;
}