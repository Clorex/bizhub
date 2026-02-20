"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const canPortal = typeof window !== "undefined" && typeof document !== "undefined";
  const el = useMemo(() => (canPortal ? document.body : null), [canPortal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !el) return null;

  return createPortal(
    <div
      aria-labelledby={title ? `sheet_title_${id}` : undefined}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60]"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className={cn(
        "absolute inset-x-0 bottom-0",
        "rounded-t-3xl bg-white shadow-float",
        "max-h-[85vh] flex flex-col overflow-hidden animate-slide-up",
        className
      )}>
        {/* Handle + Header */}
        <div className="px-4 pt-3 pb-3 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between gap-3">
            {title && (
              <h3 id={`sheet_title_${id}`} className="text-h3 text-gray-900">
                {title}
              </h3>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 overflow-auto flex-1">{children}</div>

        {footer && (
          <div className="px-4 py-4 border-t border-gray-100 bg-white safe-pb">
            {footer}
          </div>
        )}
      </div>
    </div>,
    el
  );
}
