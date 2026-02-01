import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <Card className={cn("p-4", onClick ? "cursor-pointer" : "", className)}>
      <p className="text-xs text-biz-muted">{label}</p>
      <p className="text-lg font-bold text-biz-ink mt-1">{value}</p>
      {hint ? <p className="text-[11px] text-gray-500 mt-1">{hint}</p> : null}
    </Card>
  );

  if (!onClick) return inner;

  return (
    <button className="w-full text-left" onClick={onClick}>
      {inner}
    </button>
  );
}