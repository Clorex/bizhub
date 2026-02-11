'use client';

import React from 'react';
import { TopProductsData } from '@/types/analytics';
import SectionHeader from '@/components/ui/section-header';
import EmptyState from '@/components/ui/empty-state';
import TopProductItem from './top-product-item';

interface TopProductsSectionProps {
  data: TopProductsData | null;
}

export default function TopProductsSection({ data }: TopProductsSectionProps) {
  if (!data || data.products.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
        <SectionHeader title="Top Performing Products" subtitle="Ranked by units sold" />
        <EmptyState
          title="No product data yet"
          description="Your top products will appear here after your first sales."
          icon="product"
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
      <SectionHeader
        title="Top Performing Products"
        subtitle="Ranked by units sold"
        action={
          <span className="text-xs text-gray-400">
            {data.products.length} product{data.products.length !== 1 ? 's' : ''}
          </span>
        }
      />

      <div>
        {data.products.map((product, index) => (
          <TopProductItem key={product.product_id} product={product} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}