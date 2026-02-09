import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { BrandWatermark } from "@/components/brand/BrandWatermark";

export function EmptyState({
  title,
  description,
  ctaLabel,
  onCta,
  className,
  watermark = true,
}: {
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
  watermark?: boolean;
}) {
  return (
    <Card className={cn("p-5 text-center relative", className)}>
      {watermark ? <BrandWatermark size={420} opacityClass="opacity-[0.035]" /> : null}

      <div className="relative">
        <p className="text-base font-bold text-biz-ink">{title}</p>
        {description ? <p className="text-sm text-biz-muted mt-2">{description}</p> : null}

        {ctaLabel && onCta ? (
          <div className="mt-4">
            <Button onClick={onCta}>{ctaLabel}</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}