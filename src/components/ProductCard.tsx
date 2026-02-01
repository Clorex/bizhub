"use client";

import Link from "next/link";

function formatPriceNaira(value: any) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  return `₦${n.toLocaleString()}`;
}

export function ProductCard({
  slug,
  product,
}: {
  slug: string;
  product: any;
}) {
  const name = product?.name ?? "Product";
  const price =
    product?.priceKobo != null ? Number(product.priceKobo) / 100 : product?.price;

  const img = Array.isArray(product?.images) ? product.images?.[0] : null;

  return (
    <Link
      href={`/b/${slug}/p/${product.id}`}
      className="block rounded-2xl border border-black/5 bg-white shadow-sm active:scale-[0.99] transition"
    >
      <div className="aspect-square w-full rounded-2xl bg-[#F3F4F6] overflow-hidden">
        {img ? (
          // Using <img> to avoid Next/Image domain config issues
          <img
            src={img}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
            No image
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-semibold text-gray-900 line-clamp-1">
          {name}
        </p>
        <p className="mt-1 text-sm text-gray-700">{formatPriceNaira(price)}</p>

        {/* small chip like PlugPro */}
        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-[#FFF3E6] text-[#C2410C] px-2 py-1 text-[11px] font-medium">
            View details
          </span>
        </div>
      </div>
    </Link>
  );
}