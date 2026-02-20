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
        "rounded-xl border border-gray-200 bg-gray-100/80 p-1 grid",
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
              "rounded-lg py-2.5 text-[13px] font-semibold transition-all duration-150 min-h-[40px]",
              active
                ? "text-white bg-gradient-to-r from-[#FF4D00] to-[#FF6A00] shadow-sm"
                : "text-gray-600 hover:text-gray-900",
              disabled && "opacity-40 cursor-not-allowed"
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
