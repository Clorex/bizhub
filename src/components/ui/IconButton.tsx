import { cn } from "@/lib/cn";

export function IconButton({
  className,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "secondary" | "ghost";
}) {
  const base =
    "h-10 w-10 rounded-2xl inline-flex items-center justify-center transition active:scale-[0.99] disabled:opacity-50";
  const styles =
    variant === "ghost"
      ? "bg-transparent"
      : "bg-white border border-biz-line shadow-soft";

  return <button className={cn(base, styles, className)} {...props} />;
}