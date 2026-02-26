"use client";

import { usePathname } from "next/navigation";
import { VendorBottomNav } from "@/components/vendor/VendorBottomNav";
import { cn } from "@/lib/cn";

export function VendorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const hideNav = pathname.startsWith("/vendor/subscription");

  return (
    <div className="min-h-screen bg-biz-bg">
      <div className={cn("mx-auto w-full max-w-[820px]", hideNav ? "pb-6" : "pb-24")}>
        {children}
      </div>
      {!hideNav && <VendorBottomNav />}
    </div>
  );
}
