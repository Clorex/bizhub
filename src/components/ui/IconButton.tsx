import { cn } from "@/lib/cn";

export function IconButton({
  className,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "secondary" | "ghost";
}) {
  const base =
    "h-10 w-10 rounded-xl inline-flex items-center justify-center transition-all duration-150 active:scale-[0.95] disabled:opacity-50 min-tap";
  const styles =
    variant === "ghost"
      ? "bg-transparent hover:bg-gray-100"
      : "bg-white border border-gray-200 shadow-soft hover:shadow-card hover:border-gray-300";

  return <button className={cn(base, styles, className)} {...props} />;
}
