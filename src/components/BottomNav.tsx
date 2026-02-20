"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingCart, ClipboardList, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart/CartContext";

const items = [
  { href: "/market", label: "Market", Icon: LayoutGrid },
  { href: "/cart", label: "Cart", Icon: ShoppingCart },
  { href: "/orders", label: "Orders", Icon: ClipboardList },
  { href: "/account", label: "Profile", Icon: User },
];

export function BottomNav() {
  const pathname = usePathname() || "/";
  const { cart } = useCart();

  const cartCount = (Array.isArray(cart?.items) ? cart.items : []).reduce((s: number, it: any) => {
    return s + Math.max(0, Number(it?.qty || 0));
  }, 0);

  const badgeText = cartCount > 99 ? "99+" : String(cartCount);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto w-full max-w-[430px] px-3 safe-pb pb-3">
        <nav className="rounded-2xl border border-gray-200/80 bg-white/95 backdrop-blur-lg shadow-float px-1 py-1 flex">
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const isCart = href === "/cart";

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 py-2.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors min-h-[52px]",
                  active ? "bg-orange-50" : "hover:bg-gray-50"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-5 w-5", active ? "text-[#FF4D00]" : "text-gray-400")} strokeWidth={active ? 2.5 : 2} />
                  {isCart && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF4D00] text-white text-[9px] font-bold flex items-center justify-center">
                      {badgeText}
                    </span>
                  )}
                </div>
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
