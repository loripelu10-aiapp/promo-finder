import React from 'react';
import clsx from 'clsx';
import type { DealsFilters } from '../../types';
import { CategoryFilter } from './filters/CategoryFilter';
import { BrandFilter } from './filters/BrandFilter';
import { PriceRangeSlider } from './filters/PriceRangeSlider';
import { DiscountFilter } from './filters/DiscountFilter';

interface FilterPanelProps {
  filters: DealsFilters;
  onFilterChange: (filters: Partial<DealsFilters>) => void;
  onReset: () => void;
  className?: string;
  isOpen?: boolean;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  onReset,
  className,
  isOpen = true
}) => {
  if (!isOpen) return null;

  const hasActiveFilters =
    filters.brands.length > 0 ||
    !filters.categories.includes('all' as any) ||
    filters.minDiscount > 0 ||
    filters.priceRange.max < 500 ||
    filters.priceRange.min > 0;

  return (
    <div
      className={clsx(
        'bg-gray-900 bg-opacity-50 border border-gray-700 rounded-2xl p-6',
        'animate-in slide-in-from-top duration-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </h3>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-6">
        {/* Categories */}
        <CategoryFilter
          selected={filters.categories}
          onChange={(categories) => onFilterChange({ categories })}
        />

        {/* Discount */}
        <DiscountFilter
          value={filters.minDiscount}
          onChange={(minDiscount) => onFilterChange({ minDiscount })}
        />

        {/* Price Range */}
        <PriceRangeSlider
          min={0}
          max={500}
          value={filters.priceRange}
          onChange={(priceRange) => onFilterChange({ priceRange })}
        />

        {/* Brands */}
        <BrandFilter
          selected={filters.brands}
          onChange={(brands) => onFilterChange({ brands })}
        />
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-6 pt-6 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Active Filters:</div>
          <div className="flex flex-wrap gap-2">
            {filters.brands.map((brand) => (
              <span
                key={brand}
                className="px-2 py-1 bg-orange-500 bg-opacity-20 text-orange-400 text-xs rounded-md"
              >
                {brand}
              </span>
            ))}
            {filters.minDiscount > 0 && (
              <span className="px-2 py-1 bg-orange-500 bg-opacity-20 text-orange-400 text-xs rounded-md">
                {filters.minDiscount}%+ discount
              </span>
            )}
            {(filters.priceRange.max < 500 || filters.priceRange.min > 0) && (
              <span className="px-2 py-1 bg-orange-500 bg-opacity-20 text-orange-400 text-xs rounded-md">
                €{filters.priceRange.min} - €{filters.priceRange.max}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
