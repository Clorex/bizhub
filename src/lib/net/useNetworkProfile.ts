"use client";

import { useEffect, useState } from "react";

type EffectiveType = "slow-2g" | "2g" | "3g" | "4g" | "unknown";

export function useNetworkProfile() {
  const [saveData, setSaveData] = useState(false);
  const [effectiveType, setEffectiveType] = useState<EffectiveType>("unknown");

  useEffect(() => {
    function read() {
      const c: any = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
      const sd = !!c?.saveData;
      const et = String(c?.effectiveType || "unknown") as EffectiveType;

      setSaveData(sd);
      setEffectiveType(et);
    }

    read();

    const c: any = (navigator as any)?.connection;
    if (c?.addEventListener) {
      c.addEventListener("change", read);
      return () => c.removeEventListener("change", read);
    }
  }, []);

  return { saveData, effectiveType };
}