// FILE: src/components/BottomNav.tsx
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
  const pathname = usePathname();
  const { cart } = useCart();

  const cartCount = (Array.isArray(cart?.items) ? cart.items : []).reduce((s: number, it: any) => {
    return s + Math.max(0, Number(it?.qty || 0));
  }, 0);

  const badgeText = cartCount > 99 ? "99+" : String(cartCount);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
        <div className="rounded-3xl border border-biz-line bg-white/90 backdrop-blur shadow-float px-2 py-2 flex">
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const isCart = href === "/cart";

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 py-2 flex flex-col items-center justify-center gap-1 rounded-2xl transition",
                  active ? "bg-biz-cream" : "hover:bg-black/5"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-5 w-5", active ? "text-biz-accent" : "text-gray-500")} />

                  {/* ✅ Cart count badge */}
                  {isCart && cartCount > 0 ? (
                    <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-biz-accent text-white text-[10px] font-extrabold flex items-center justify-center">
                      {badgeText}
                    </span>
                  ) : null}
                </div>

                <span className={cn("text-[11px]", active ? "font-extrabold text-biz-accent" : "text-gray-500")}>
                  {label}
                </span>

                {/* small active indicator */}
                <span
                  className={cn(
                    "h-1 w-6 rounded-full transition",
                    active ? "bg-gradient-to-r from-biz-accent2 to-biz-accent" : "bg-transparent"
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