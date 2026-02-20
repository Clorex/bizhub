import { cn } from "@/lib/cn";

export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold border transition-all duration-150 min-h-[36px] active:scale-[0.97]",
        active
          ? "bg-gradient-to-br from-[#FF4D00] to-[#FF6A00] text-white border-transparent shadow-sm"
          : "bg-white border-gray-200 text-gray-700 hover:border-orange-200 hover:bg-orange-50/50",
        className
      )}
      {...props}
    />
  );
}
