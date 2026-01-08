import React from 'react';
import clsx from 'clsx';
import type { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from '../ui/LoadingSkeleton';

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  onViewDeal?: (product: Product) => void;
  className?: string;
  emptyMessage?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  loading = false,
  onViewDeal,
  className,
  emptyMessage = 'No deals found. Try adjusting your filters.'
}) => {
  if (loading) {
    return (
      <div className={clsx('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-24 h-24 mb-6 text-gray-600">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-300 mb-2">No Deals Found</h3>
        <p className="text-gray-500 max-w-md">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={clsx('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6', className)}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          onViewDeal={onViewDeal}
          index={index}
        />
      ))}
    </div>
  );
};
