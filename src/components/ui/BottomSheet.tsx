"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
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
  const el = useMemo(() => {
    if (!canPortal) return null;
    return document.body;
  }, [canPortal]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    // lock scroll
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
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0",
          "rounded-t-[26px] bg-white border border-biz-line shadow-float",
          "max-h-[85vh] flex flex-col overflow-hidden",
          className
        )}
      >
        <div className="px-4 pt-3 pb-3 border-b border-biz-line">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {title ? (
                <p id={`sheet_title_${id}`} className="text-sm font-extrabold text-biz-ink">
                  {title}
                </p>
              ) : null}
              <div className="mt-2 h-1 w-10 bg-black/10 rounded-full mx-auto" />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-xs font-extrabold text-gray-600 px-3 py-2 rounded-2xl hover:bg-black/[0.03]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="px-4 py-4 overflow-auto">{children}</div>

        {footer ? (
          <div className="px-4 py-4 border-t border-biz-line bg-white">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    el
  );
}