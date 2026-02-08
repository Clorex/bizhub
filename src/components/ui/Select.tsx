import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none",
        "focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40",
        className
      )}
      {...props}
    />
  );
}