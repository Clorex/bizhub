"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

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
    if (t === "dark") return "bg-gradient-to-br from-gray-900 to-gray-800 text-white";
    if (t === "cream") return "bg-gradient-to-br from-biz-cream to-biz-sand text-gray-900";
    return "bg-gradient-to-br from-[#FF4D00] to-[#FF6A00] text-white";
  }, [banners, i]);

  return (
    <div className="space-y-2.5">
      <div className={`rounded-2xl p-5 shadow-card ${toneClass} transition-all duration-200`}>
        <p className="text-h3">{banners[i].title}</p>
        <p className="text-caption opacity-80 mt-1">{banners[i].subtitle}</p>

        <div className="mt-4">
          <Link
            href={banners[i].href}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 px-4 py-2.5 text-[13px] font-semibold transition"
          >
            {banners[i].cta}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={idx === i
                ? "h-2 w-5 rounded-full bg-[#FF4D00] transition-all"
                : "h-2 w-2 rounded-full bg-gray-300 hover:bg-gray-400 transition-all"
              }
              aria-label={`Banner ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
