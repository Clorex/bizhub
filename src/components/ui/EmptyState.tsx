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
    <div className={cn("text-center relative", variant === "card" ? "p-6" : "py-12 px-5", className)}>
      {variant === "card" && watermark && (
        <BrandWatermark size={420} opacityClass="opacity-[0.025]" />
      )}

      <div className="relative flex flex-col items-center">
        {icon && <div className="mb-5">{icon}</div>}

        <h3 className="text-h3 text-gray-900">{title}</h3>

        {description && (
          <p className="mt-2 text-body text-gray-500 max-w-sm">{description}</p>
        )}

        {mergedActions.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {mergedActions.map((a, idx) => (
              <Button
                key={idx}
                onClick={a.onClick}
                variant={a.variant === "secondary" ? "secondary" : "primary"}
                size={a.size || (variant === "plain" ? "sm" : "md")}
                leftIcon={a.leftIcon}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (variant === "plain") return Content;
  return <Card className={cn("relative", className)}>{Content}</Card>;
}
