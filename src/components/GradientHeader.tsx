"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function GradientHeader({
  title,
  subtitle,
  showBack = false,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn("relative", className)}>
      <div className="h-1.5 w-full bg-gradient-to-r from-[#FF4D00] to-[#FF6A00]" />

      <div className="px-4 pt-4 pb-4 bg-gradient-to-b from-biz-sand/60 to-biz-bg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {showBack && (
              <button
                onClick={() => router.back()}
                className="h-10 w-10 rounded-xl bg-white border border-gray-200 shadow-soft flex items-center justify-center text-gray-700 hover:bg-gray-50 transition active:scale-95 shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {!showBack && (
              <div className="shrink-0">
                <BrandLogo size={32} priority />
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 truncate">{title}</h1>
              {subtitle && <p className="text-caption text-gray-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>

          {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
        </div>
      </div>
    </div>
  );
}

export default GradientHeader;
