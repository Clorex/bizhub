// FILE: src/components/ui/ConfirmDialog.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
  onClose,
  icon,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  icon?: ReactNode;
}) {
  const canPortal = typeof window !== "undefined" && typeof document !== "undefined";
  const el = useMemo(() => (canPortal ? document.body : null), [canPortal]);

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
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
        disabled={loading}
      />

      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center p-4 pb-safe">
        <Card className={cn("w-full md:max-w-[440px] p-5 rounded-3xl", loading && "pointer-events-none opacity-95")}>
          <div className="flex items-start gap-3">
            {icon ? <div className="shrink-0 mt-0.5">{icon}</div> : null}
            <div className="min-w-0">
              <p className="text-base font-extrabold text-gray-900">{title}</p>
              {description ? (
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{description}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {cancelText}
            </Button>

            <Button
              variant={tone === "danger" ? "danger" : undefined}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmText}
            </Button>
          </div>
        </Card>
      </div>
    </div>,
    el
  );
}