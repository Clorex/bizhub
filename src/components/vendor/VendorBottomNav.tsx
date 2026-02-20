"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ClipboardList, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/vendor", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/vendor/products", label: "Products", Icon: Package },
  { href: "/vendor/orders", label: "Orders", Icon: ClipboardList },
  { href: "/vendor/more", label: "More", Icon: MoreHorizontal },
];

export function VendorBottomNav() {
  const pathname = usePathname() || "/";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto w-full max-w-[640px] px-3 safe-pb pb-3">
        <nav className="rounded-2xl border border-gray-200/80 bg-white/95 backdrop-blur-lg shadow-float px-1 py-1 flex">
          {items.map(({ href, label, Icon, exact }) => {
            const active = exact
              ? pathname === href || pathname === href + "/"
              : pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 py-2.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors min-h-[52px]",
                  active ? "bg-orange-50" : "hover:bg-gray-50"
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-[#FF4D00]" : "text-gray-400")} strokeWidth={active ? 2.5 : 2} />
                <span className={cn("text-[10px]", active ? "font-bold text-[#FF4D00]" : "font-medium text-gray-400")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
