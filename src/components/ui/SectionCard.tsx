import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";

export function SectionCard({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-biz-ink">{title}</p>
          {subtitle ? (
            <p className="text-xs text-biz-muted mt-1">{subtitle}</p>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div className="mt-3">{children}</div>
    </Card>
  );
}