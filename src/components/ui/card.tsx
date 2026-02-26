import React from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "interactive" | "elevated" | "flat";
  onClick?: () => void;
}

export default function Card({
  children,
  className = "",
  padding = "md",
  variant = "default",
  onClick,
}: CardProps) {
  const variants = {
    default: "bg-white rounded-2xl border border-line shadow-card",
    interactive: "bg-white rounded-2xl border border-line shadow-card cursor-pointer transition-all duration-200 hover:shadow-elevated hover:-translate-y-0.5 active:scale-[0.98]",
    elevated: "bg-white rounded-2xl border border-line/50 shadow-float",
    flat: "bg-surface-secondary rounded-2xl border border-line",
  };

  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
        variants[variant],
        paddings[padding],
        "animate-fade-in-up",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className = "" }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-3", className)}>
      <div>
        <h3 className="text-h3 text-ink">{title}</h3>
        {subtitle && (
          <p className="text-caption text-ink-lighter mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={cn("mt-4 pt-4 border-t border-line", className)}>
      {children}
    </div>
  );
}
