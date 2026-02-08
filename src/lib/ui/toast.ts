// FILE: src/lib/ui/toast.ts
export type ToastVariant = "success" | "error" | "info";

export type ToastPayload = {
  id?: string;
  variant?: ToastVariant;
  title?: string;
  message: string;
  durationMs?: number; // default 2200
};

const EVENT_NAME = "bizhub_toast";

function uid() {
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function emit(payload: ToastPayload) {
  if (typeof window === "undefined") return;

  const detail = {
    id: payload.id || uid(),
    variant: payload.variant || "info",
    title: payload.title || "",
    message: String(payload.message || "").slice(0, 220),
    durationMs: Number.isFinite(payload.durationMs) ? Math.max(800, Number(payload.durationMs)) : 2200,
  };

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export const toast = {
  info(message: string, opts?: Omit<ToastPayload, "message" | "variant">) {
    emit({ variant: "info", message, ...opts });
  },
  success(message: string, opts?: Omit<ToastPayload, "message" | "variant">) {
    emit({ variant: "success", message, ...opts });
  },
  error(message: string, opts?: Omit<ToastPayload, "message" | "variant">) {
    emit({ variant: "error", message, ...opts, durationMs: opts?.durationMs ?? 3200 });
  },
};

export function toastFromError(e: any, fallback = "Something went wrong. Please try again.") {
  const msg = String(e?.message || "").trim();
  toast.error(msg || fallback);
}