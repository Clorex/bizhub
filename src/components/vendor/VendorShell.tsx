"use client";

import { usePathname } from "next/navigation";
import { VendorBottomNav } from "@/components/vendor/VendorBottomNav";

export function VendorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // When locked, user will be on /vendor/subscription (or summary).
  // Hide the vendor bottom nav there so the screen is “subscription-only”.
  const hideNav = pathname.startsWith("/vendor/subscription");

  return (
    <div className="min-h-screen">
      <div className={hideNav ? "pb-6" : "pb-24"}>{children}</div>
      {hideNav ? null : <VendorBottomNav />}
    </div>
  );
}