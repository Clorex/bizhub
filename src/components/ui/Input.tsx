"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, label, error, success, hint, type, ...props }, ref) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="w-full">
        {label && (
          <label className="block text-caption font-semibold text-ink-light mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={isPassword && showPassword ? "text" : type}
            className={cn(
              "w-full rounded-xl border bg-surface px-4 py-3 text-body-sm outline-none transition-all duration-150",
              "placeholder:text-ink-lightest",
              error
                ? "border-error focus:ring-2 focus:ring-error/20 focus:border-error"
                : success
                ? "border-success focus:ring-2 focus:ring-success/20 focus:border-success"
                : "border-line focus:ring-2 focus:ring-brand/20 focus:border-brand",
              isPassword && "pr-12",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-lighter hover:text-ink transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {error && <p className="mt-1.5 text-caption text-error font-medium">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-caption text-ink-lighter">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
