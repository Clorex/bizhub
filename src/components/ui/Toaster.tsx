"use client";

import { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
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

const variantConfig: Record<ToastVariant, { border: string; bg: string; text: string; icon: any }> = {
  success: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-800", icon: CheckCircle2 },
  error: { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", icon: AlertCircle },
  info: { border: "border-gray-200", bg: "bg-white", text: "text-gray-800", icon: Info },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, any>>({});

  function remove(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const t = timers.current[id];
    if (t) { try { clearTimeout(t); } catch {} delete timers.current[id]; }
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
        const filtered = prev.filter((x) => x.id !== id);
        return [next, ...filtered].slice(0, 3);
      });

      timers.current[id] = setTimeout(() => remove(id), next.durationMs);
    }

    window.addEventListener(EVENT_NAME, onToast as any);
    return () => window.removeEventListener(EVENT_NAME, onToast as any);
  }, []);

  if (!items.length) return null;

  return (
    <div className="fixed left-0 right-0 z-[60] pointer-events-none bottom-24 md:bottom-6">
      <div className="mx-auto w-full max-w-[400px] px-4 space-y-2">
        {items.map((t) => {
          const config = variantConfig[t.variant];
          const IconComp = config.icon;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto rounded-xl border shadow-float px-4 py-3",
                "flex items-start gap-3 animate-fade-in-up",
                config.border, config.bg, config.text
              )}
            >
              <IconComp className="w-5 h-5 shrink-0 mt-0.5 opacity-70" />
              <div className="min-w-0 flex-1">
                {t.title && <p className="text-[13px] font-bold">{t.title}</p>}
                <p className={cn("text-[13px]", t.title && "mt-0.5")}>{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="shrink-0 w-7 h-7 rounded-lg hover:bg-black/5 flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
