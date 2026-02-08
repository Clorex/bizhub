// FILE: src/components/ui/Toaster.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { ToastVariant } from "@/lib/ui/toast";

type ToastItem = {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  durationMs: number;
  createdAtMs: number;
};

const EVENT_NAME = "bizhub_toast";

function variantStyles(v: ToastVariant) {
  if (v === "success") return "border-emerald-100 bg-emerald-50 text-emerald-800";
  if (v === "error") return "border-rose-100 bg-rose-50 text-rose-800";
  return "border-biz-line bg-white text-biz-ink";
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, any>>({});

  function remove(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const t = timers.current[id];
    if (t) {
      try {
        clearTimeout(t);
      } catch {}
      delete timers.current[id];
    }
  }

  useEffect(() => {
    function onToast(ev: any) {
      const d = ev?.detail || {};
      const id = String(d.id || "");
      if (!id) return;

      const next: ToastItem = {
        id,
        variant: (String(d.variant || "info") as ToastVariant) || "info",
        title: d.title ? String(d.title).slice(0, 60) : "",
        message: String(d.message || "").slice(0, 220),
        durationMs: Number(d.durationMs || 2200),
        createdAtMs: Date.now(),
      };

      setItems((prev) => {
        // keep max 3 visible
        const filtered = prev.filter((x) => x.id !== id);
        return [next, ...filtered].slice(0, 3);
      });

      // auto dismiss
      timers.current[id] = setTimeout(() => remove(id), next.durationMs);
    }

    window.addEventListener(EVENT_NAME, onToast as any);
    return () => window.removeEventListener(EVENT_NAME, onToast as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!items.length) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-[60] pointer-events-none",
        // keep above customer bottom nav
        "bottom-24 md:bottom-6"
      )}
    >
      <div className="mx-auto w-full max-w-[430px] px-4 space-y-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-2xl border shadow-soft px-4 py-3",
              "flex items-start justify-between gap-3",
              variantStyles(t.variant)
            )}
          >
            <div className="min-w-0">
              {t.title ? <p className="text-xs font-extrabold">{t.title}</p> : null}
              <p className={t.title ? "text-sm mt-1" : "text-sm"}>{t.message}</p>
            </div>

            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 h-8 w-8 rounded-xl border border-black/5 bg-white/70 hover:bg-white"
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}