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
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
        disabled={loading}
      />

      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center p-4 pb-safe">
        <Card className={cn("w-full md:max-w-[420px] p-5 animate-scale-in", loading && "pointer-events-none opacity-95")}>
          <div className="flex items-start gap-3">
            {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
            <div className="min-w-0">
              <h3 className="text-h3 text-gray-900">{title}</h3>
              {description && (
                <p className="text-body text-gray-600 mt-2 whitespace-pre-line">{description}</p>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {cancelText}
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
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
