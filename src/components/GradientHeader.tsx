"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export function GradientHeader({
  title,
  subtitle,
  showBack = false,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn("relative", className)}>
      {/* Brand strip */}
      <div className="h-2 w-full bg-gradient-to-r from-biz-accent2 to-biz-accent" />

      {/* Header body */}
      <div className="px-4 pt-5 pb-5 bg-gradient-to-b from-biz-sand to-biz-bg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {showBack ? (
              <button
                onClick={() => router.back()}
                className={cn(
                  "h-10 w-10 rounded-2xl bg-white border border-biz-line shadow-soft",
                  "flex items-center justify-center text-biz-ink"
                )}
                aria-label="Back"
              >
                <span className="text-lg leading-none">←</span>
              </button>
            ) : null}

            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-biz-ink">
                {title}
                <span className="text-biz-accent">.</span>
              </h1>

              {subtitle ? (
                <p className="text-xs text-biz-muted mt-1">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default GradientHeader;