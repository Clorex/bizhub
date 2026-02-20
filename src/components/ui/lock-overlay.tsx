"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
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
      <div className="filter blur-[8px] pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-orange-500" />
        </div>

        <h3 className="text-h3 text-gray-900 mb-2">{title}</h3>
        <p className="text-body text-gray-500 mb-5 max-w-[280px]">{description}</p>

        <Button variant="primary" size="md" onClick={() => router.push(buttonHref)}>
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
