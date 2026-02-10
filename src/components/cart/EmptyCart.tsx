// FILE: src/components/cart/EmptyCart.tsx
"use client";

import Link from "next/link";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyCartProps {
  storeSlug?: string | null;
}

export function EmptyCart({ storeSlug }: EmptyCartProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
        <ShoppingCart className="w-10 h-10 text-gray-400" />
      </div>

      <h2 className="text-xl font-bold text-gray-900">Your cart is empty</h2>
      <p className="text-sm text-gray-500 mt-2 max-w-xs">
        Looks like you haven't added any items to your cart yet. Start shopping to fill it up!
      </p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        <Link href="/market" className="block">
          <Button className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Explore Marketplace
          </Button>
        </Link>

        {storeSlug && (
          <Link href={`/b/${storeSlug}`} className="block">
            <Button variant="secondary" className="w-full">
              Back to Store
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}