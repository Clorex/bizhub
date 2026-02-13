import React from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { BrandWatermark } from "@/components/brand/BrandWatermark";

type EmptyStateAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  leftIcon?: React.ReactNode;
};

export function EmptyState({
  title,
  description,
  icon,
  actions,
  // Back-compat props (older call sites)
  ctaLabel,
  onCta,
  className,
  watermark = true,
  variant = "card",
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: EmptyStateAction[];

  // Back-compat
  ctaLabel?: string;
  onCta?: () => void;

  className?: string;
  watermark?: boolean;
  variant?: "card" | "plain";
}) {
  const mergedActions: EmptyStateAction[] = React.useMemo(() => {
    if (actions && actions.length > 0) return actions;
    if (ctaLabel && onCta) return [{ label: ctaLabel, onClick: onCta, variant: "primary" }];
    return [];
  }, [actions, ctaLabel, onCta]);

  const Content = (
    <div className={cn("text-center relative", variant === "card" ? "p-5" : "py-10 px-5", className)}>
      {variant === "card" && watermark ? (
        <BrandWatermark size={420} opacityClass="opacity-[0.035]" />
      ) : null}

      <div className="relative flex flex-col items-center">
        {icon ? (
          <div className={cn("mb-4", variant === "card" ? "" : "")}>{icon}</div>
        ) : null}

        <p className={cn("font-bold", variant === "card" ? "text-base text-biz-ink" : "text-base text-gray-900")}>
          {title}
        </p>

        {description ? (
          <p className={cn("mt-2", variant === "card" ? "text-sm text-biz-muted" : "text-sm text-gray-500 max-w-sm")}>
            {description}
          </p>
        ) : null}

        {mergedActions.length > 0 ? (
          <div className={cn("mt-4 flex flex-wrap justify-center gap-3")}>
            {mergedActions.map((a, idx) => (
              <Button
                key={idx}
                onClick={a.onClick}
                variant={a.variant === "secondary" ? "secondary" : undefined}
                size={a.size || (variant === "plain" ? "sm" : "md")}
                leftIcon={a.leftIcon}
              >
                {a.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (variant === "plain") return Content;

  return <Card className={cn("relative", className)}>{Content}</Card>;
}