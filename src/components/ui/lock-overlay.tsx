// FILE: src/components/ui/lock-overlay.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface LockOverlayProps {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonHref?: string;
  children: React.ReactNode;
  className?: string;
}

export default function LockOverlay({
  title = "Unlock Advanced Analytics",
  description = "Upgrade your plan to access detailed performance insights.",
  buttonText = "Upgrade Now",
  buttonHref = "/vendor/subscription",
  children,
  className = "",
}: LockOverlayProps) {
  const router = useRouter();

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Blurred content behind overlay */}
      <div className="filter blur-[8px] pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm p-6 text-center">
        <svg
          className="w-12 h-12 text-orange-500 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>

        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-5 max-w-[280px]">{description}</p>

        <Button
          variant="primary"
          size="md"
          onClick={() => router.push(buttonHref)}
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}