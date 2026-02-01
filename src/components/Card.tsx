import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "soft" | "ghost";

export function Card(
  props: ComponentPropsWithoutRef<"div"> & { variant?: CardVariant }
) {
  const { className = "", variant = "default", ...rest } = props;

  const base =
    "rounded-[22px] border shadow-soft overflow-hidden";
  const styles =
    variant === "soft"
      ? "bg-biz-cream border-transparent"
      : variant === "ghost"
        ? "bg-transparent border-transparent shadow-none"
        : "bg-white border-biz-line";

  return <div className={cn(base, styles, className)} {...rest} />;
}