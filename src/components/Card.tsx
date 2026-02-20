import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "soft" | "ghost";

export function Card(
  props: ComponentPropsWithoutRef<"div"> & { variant?: CardVariant }
) {
  const { className = "", variant = "default", ...rest } = props;

  const base = "rounded-2xl overflow-hidden transition-shadow duration-150";
  const styles =
    variant === "soft"
      ? "bg-biz-cream border border-transparent shadow-soft"
      : variant === "ghost"
        ? "bg-transparent border-transparent"
        : "bg-white border border-gray-100 shadow-card";

  return <div className={cn(base, styles, className)} {...rest} />;
}
