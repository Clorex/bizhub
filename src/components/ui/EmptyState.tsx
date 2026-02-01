import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  ctaLabel,
  onCta,
  className,
}: {
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("p-5 text-center", className)}>
      <p className="text-base font-bold text-biz-ink">{title}</p>
      {description ? (
        <p className="text-sm text-biz-muted mt-2">{description}</p>
      ) : null}

      {ctaLabel && onCta ? (
        <div className="mt-4">
          <Button onClick={onCta}>{ctaLabel}</Button>
        </div>
      ) : null}
    </Card>
  );
}