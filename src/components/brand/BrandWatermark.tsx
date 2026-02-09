"use client";

import { cn } from "@/lib/cn";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function BrandWatermark({
  className,
  opacityClass = "opacity-[0.05]",
  size = 520,
}: {
  className?: string;
  opacityClass?: string; // allows tweaking per page
  size?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none select-none",
        "absolute inset-0 flex items-center justify-center",
        opacityClass,
        className
      )}
    >
      <div className="rotate-[-10deg]">
        <BrandLogo size={size} className="rounded-[40px]" />
      </div>
    </div>
  );
}