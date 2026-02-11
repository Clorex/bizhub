'use client';

import React from 'react';
import { TopProduct } from '@/types/analytics';
import { formatNaira, formatPercentageWithSign } from '@/lib/analytics/format';

interface TopProductItemProps {
  product: TopProduct;
  rank: number;
}

export default function TopProductItem({ product, rank }: TopProductItemProps) {
  const isPositive = product.growth_percentage > 0;
  const isNegative = product.growth_percentage < 0;
  const trendColor = isPositive
    ? 'text-green-500 bg-green-50'
    : isNegative
    ? 'text-red-500 bg-red-50'
    : 'text-gray-400 bg-gray-50';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
      {/* Rank */}
      <span className="text-sm font-bold text-orange-500 w-6 text-center">#{rank}</span>

      {/* Product image placeholder */}
      <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden">
        {product.product_image ? (
          <img
            src={product.product_image}
            alt={product.product_name}
            className="w-full h-full object-cover rounded-xl"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.innerHTML = `
                  <svg class="w-5 h-5 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                `;
              }
            }}
          />
        ) : (
          <svg
            className="w-5 h-5 text-orange-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{product.product_name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {product.units_sold} unit{product.units_sold !== 1 ? 's' : ''} · {formatNaira(product.revenue)}
        </p>
      </div>

      {/* Growth indicator */}
      {product.trend !== 'neutral' && (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trendColor}`}>
          <svg
            className={`w-3 h-3 ${isNegative ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          {formatPercentageWithSign(product.growth_percentage)}
        </span>
      )}
    </div>
  );
}