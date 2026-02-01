"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Banner = {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  tone?: "orange" | "cream" | "dark";
};

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);

  const toneClass = useMemo(() => {
    const t = banners[i]?.tone ?? "orange";
    if (t === "dark") return "bg-gradient-to-br from-[#111827] to-[#1f2937] text-white";
    if (t === "cream") return "bg-gradient-to-br from-biz-cream to-biz-sand text-biz-ink";
    return "bg-gradient-to-br from-biz-accent2 to-biz-accent text-white";
  }, [banners, i]);

  return (
    <div className="space-y-2">
      <div className={`rounded-2xl p-4 shadow-soft ${toneClass}`}>
        <p className="text-sm font-extrabold">{banners[i].title}</p>
        <p className="text-xs opacity-90 mt-1">{banners[i].subtitle}</p>

        <div className="mt-3 flex items-center justify-between">
          <Link
            href={banners[i].href}
            className="rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold"
          >
            {banners[i].cta}
          </Link>

          <div className="h-12 w-12 rounded-2xl bg-white/15" />
        </div>
      </div>

      <div className="flex justify-center gap-2">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            className={idx === i ? "h-2.5 w-5 rounded-full bg-biz-accent" : "h-2.5 w-2.5 rounded-full bg-gray-300"}
            aria-label={`banner-${idx}`}
          />
        ))}
      </div>
    </div>
  );
}