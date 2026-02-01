"use client";

import { BottomNav } from "@/components/BottomNav";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideAllNav =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account/login") ||
    pathname.startsWith("/account/register") ||
    pathname.startsWith("/account/forgot") ||
    pathname.startsWith("/account/verify") ||
    pathname.startsWith("/account/invite") ||
    pathname.startsWith("/payment/callback") ||
    pathname.startsWith("/payment/subscription/callback") ||
    pathname.startsWith("/payment/promotion/callback");

  const isVendor = pathname.startsWith("/vendor");

  const showCustomerNav = !hideAllNav && !isVendor;
  const contentPad = hideAllNav ? "pb-6" : "pb-28";

  return (
    <div className="min-h-screen bg-biz-bg">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-biz-bg">
        <div className={contentPad}>{children}</div>
      </div>

      {showCustomerNav ? <BottomNav /> : null}
    </div>
  );
}