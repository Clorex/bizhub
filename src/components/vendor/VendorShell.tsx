"use client";

import { usePathname } from "next/navigation";
import { VendorBottomNav } from "@/components/vendor/VendorBottomNav";
import { cn } from "@/lib/cn";

export function VendorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/vendor/subscription");

  return (
    <div className="min-h-screen">
      {/* Responsive container: full-width mobile, centered 820px on desktop */}
      <div
        className={cn(
          "mx-auto w-full max-w-[820px]",
          hideNav ? "pb-6" : "pb-28"
        )}
      >
        {children}
      </div>
      {hideNav ? null : <VendorBottomNav />}
    </div>
  );
}
