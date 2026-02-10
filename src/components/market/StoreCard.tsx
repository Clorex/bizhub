// FILE: src/components/market/StoreCard.tsx
"use client";

import { memo } from "react";
import Link from "next/link";
import { Store, MapPin, BadgeCheck } from "lucide-react";

interface StoreCardProps {
  store: any;
}

export const StoreCard = memo(function StoreCard({ store: b }: StoreCardProps) {
  const slug = String(b?.slug || "").trim();
  const name = String(b?.name || slug || "Store");
  const state = String(b?.state || "").trim();
  const city = String(b?.city || "").trim();
  const loc = [city, state].filter(Boolean).join(", ");
  const description = String(b?.description || "").trim();
  const verified = Number(b?.verificationTier || 0) >= 2;

  if (!slug) return null;

  return (
    <Link
      href={`/b/${slug}`}
      className="block rounded-2xl border border-gray-100 bg-white p-4 hover:border-orange-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center shrink-0">
          <Store className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900 truncate">{name}</p>
            {verified && (
              <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <span className="font-medium">@{slug}</span>
            {loc && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {loc}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});