"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/vendor", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/vendor/products", label: "Products", Icon: Package },
  { href: "/vendor/orders", label: "Orders", Icon: ClipboardList },
  { href: "/vendor/more", label: "More", Icon: MoreHorizontal },
];

export function VendorBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto w-full max-w-[640px] px-4 safe-pb pb-4">
        <div className="rounded-3xl border border-biz-line bg-white/90 backdrop-blur shadow-float px-2 py-2 flex">
          {items.map(({ href, label, Icon, exact }) => {
            const active = exact
              ? pathname === href || pathname === href + "/"
              : pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 py-2 flex flex-col items-center justify-center gap-1 rounded-2xl transition min-h-[44px]",
                  "hover:bg-black/5"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-biz-accent" : "text-gray-500"
                  )}
                />
                <span
                  className={cn(
                    "text-[11px]",
                    active ? "font-extrabold text-biz-accent" : "text-gray-500"
                  )}
                >
                  {label}
                </span>

                <span
                  className={cn(
                    "h-1 w-6 rounded-full transition-colors",
                    active
                      ? "bg-gradient-to-r from-biz-accent2 to-biz-accent"
                      : "bg-transparent"
                  )}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
