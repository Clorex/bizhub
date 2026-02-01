import { cn } from "@/lib/cn";

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-biz-line bg-white shadow-soft p-1 grid",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        const disabled = !!o.disabled;

        return (
          <button
            key={o.value}
            onClick={() => (!disabled ? onChange(o.value) : undefined)}
            disabled={disabled}
            className={cn(
              "rounded-2xl py-2 text-xs font-bold transition",
              active
                ? "text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                : "text-biz-ink",
              disabled ? "opacity-40 cursor-not-allowed" : ""
            )}
            title={disabled ? "Locked on current plan" : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}