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
    <Card className={cn("p-4", onClick && "cursor-pointer hover:shadow-float hover:border-orange-200 transition-all", className)}>
      <p className="text-micro text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1.5 tracking-tight">{value}</p>
      {hint && <p className="text-micro text-gray-400 mt-1">{hint}</p>}
    </Card>
  );

  if (!onClick) return inner;

  return (
    <button className="w-full text-left" onClick={onClick}>
      {inner}
    </button>
  );
}
