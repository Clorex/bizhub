import { cn } from "@/lib/cn";

export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold border transition shadow-sm",
        active
          ? "bg-gradient-to-br from-biz-accent2 to-biz-accent text-white border-transparent"
          : "bg-white border-biz-line text-gray-700",
        className
      )}
      {...props}
    />
  );
}