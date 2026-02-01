"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingCart, ClipboardList, User } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/market", label: "Market", Icon: LayoutGrid },
  { href: "/cart", label: "Cart", Icon: ShoppingCart },
  { href: "/orders", label: "Orders", Icon: ClipboardList },
  { href: "/account", label: "Profile", Icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
        <div className="rounded-3xl border border-biz-line bg-white/90 backdrop-blur shadow-float px-2 py-2 flex">
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 py-2 flex flex-col items-center justify-center gap-1 rounded-2xl transition",
                  active ? "bg-biz-cream" : "hover:bg-black/5"
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

                {/* small active indicator */}
                <span
                  className={cn(
                    "h-1 w-6 rounded-full transition",
                    active
                      ? "bg-gradient-to-r from-biz-accent2 to-biz-accent"
                      : "bg-transparent"
                  )}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}