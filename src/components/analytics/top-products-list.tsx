'use client';

import React from 'react';
import { TopProduct } from '@/types/analytics';
import TopProductItem from './top-product-item';

interface TopProductsListProps {
  products: TopProduct[];
}

/**
 * Top Products List
 * Renders the ranked list of top products.
 * NOT a chart — this is a list per spec.
 */
export default function TopProductsList({ products }: TopProductsListProps) {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="divide-y-0">
      {products.map((product, index) => (
        <TopProductItem
          key={product.product_id}
          product={product}
          rank={index + 1}
        />
      ))}
    </div>
  );
}