import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { DealsFilters, Gender, SmartCategory} from '../../types';
import { GenderFilter } from './filters/GenderFilter';
import { RetailerFilter } from './filters/RetailerFilter';
import { SmartFilter } from './filters/SmartFilter';

interface RetailerCount {
  name: string;
  count: number;
}

interface FilterBarProps {
  filters: DealsFilters;
  onFilterChange: (filters: Partial<DealsFilters>) => void;
  onReset: () => void;
  retailers: RetailerCount[];
  totalProducts: number;
}

// Price presets
const PRICE_PRESETS = [
  { label: 'Under $25', min: 0, max: 25 },
  { label: '$25 - $50', min: 25, max: 50 },
  { label: '$50 - $100', min: 50, max: 100 },
  { label: '$100 - $200', min: 100, max: 200 },
  { label: 'Over $200', min: 200, max: 500 }
];

// Discount presets
const DISCOUNT_PRESETS = [
  { label: '20%+', value: 20 },
  { label: '30%+', value: 30 },
  { label: '50%+', value: 50 },
  { label: '70%+', value: 70 }
];

// Category presets
const CATEGORY_PRESETS = [
  { value: 'shoes', label: 'Shoes' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'athletic', label: 'Athletic' },
  { value: 'casual', label: 'Casual' },
  { value: 'streetwear', label: 'Streetwear' }
];

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  retailers,
  totalProducts
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown) {
        const ref = dropdownRefs.current[openDropdown];
        if (ref && !ref.contains(event.target as Node)) {
          setOpenDropdown(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.genders.length > 0 ||
    filters.retailers.length > 0 ||
    filters.minDiscount > 0 ||
    filters.priceRange.max < 500 ||
    filters.priceRange.min > 0 ||
    filters.smartFilters.bestValue ||
    filters.smartFilters.topDeal ||
    filters.smartFilters.priceDrop ||
    filters.smartCategories.length > 0;

  // Get active filter pills
  const getActiveFilterPills = () => {
    const pills: { label: string; onRemove: () => void }[] = [];

    filters.genders.forEach(g => {
      pills.push({
        label: g.charAt(0).toUpperCase() + g.slice(1),
        onRemove: () => onFilterChange({ genders: filters.genders.filter(x => x !== g) })
      });
    });

    filters.retailers.forEach(r => {
      pills.push({
        label: r,
        onRemove: () => onFilterChange({ retailers: filters.retailers.filter(x => x !== r) })
      });
    });

    if (filters.minDiscount > 0) {
      pills.push({
        label: `${filters.minDiscount}%+ Off`,
        onRemove: () => onFilterChange({ minDiscount: 0 })
      });
    }

    if (filters.priceRange.min > 0 || filters.priceRange.max < 500) {
      pills.push({
        label: `$${filters.priceRange.min} - $${filters.priceRange.max}`,
        onRemove: () => onFilterChange({ priceRange: { min: 0, max: 500 } })
      });
    }

    if (filters.smartFilters.bestValue) {
      pills.push({
        label: 'Best Value',
        onRemove: () => onFilterChange({ smartFilters: { ...filters.smartFilters, bestValue: false } })
      });
    }

    if (filters.smartFilters.topDeal) {
      pills.push({
        label: 'Top Deal',
        onRemove: () => onFilterChange({ smartFilters: { ...filters.smartFilters, topDeal: false } })
      });
    }

    if (filters.smartFilters.priceDrop) {
      pills.push({
        label: 'Price Drop',
        onRemove: () => onFilterChange({ smartFilters: { ...filters.smartFilters, priceDrop: false } })
      });
    }

    filters.smartCategories.forEach(cat => {
      pills.push({
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        onRemove: () => onFilterChange({ smartCategories: filters.smartCategories.filter(x => x !== cat) })
      });
    });

    return pills;
  };

  const activePills = getActiveFilterPills();

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 mb-6">
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Gender Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Gender:</span>
          <GenderFilter
            selected={filters.genders}
            onChange={(genders) => onFilterChange({ genders })}
          />
        </div>

        <div className="h-6 w-px bg-gray-700" />

        {/* Retailer Filter */}
        <RetailerFilter
          retailers={retailers}
          selected={filters.retailers}
          onChange={(retailers) => onFilterChange({ retailers })}
        />

        {/* Category Dropdown */}
        <div className="relative" ref={el => dropdownRefs.current['category'] = el}>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              'border flex items-center gap-2',
              filters.smartCategories.length > 0
                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-blue-400'
            )}
          >
            <span>Category</span>
            {filters.smartCategories.length > 0 && (
              <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {filters.smartCategories.length}
              </span>
            )}
            <svg className={clsx('w-4 h-4 transition-transform', openDropdown === 'category' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {openDropdown === 'category' && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-2">
              {CATEGORY_PRESETS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    const cats = filters.smartCategories as SmartCategory[];
                    if (cats.includes(value as SmartCategory)) {
                      onFilterChange({ smartCategories: cats.filter(c => c !== value) });
                    } else {
                      onFilterChange({ smartCategories: [...cats, value as SmartCategory] });
                    }
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    (filters.smartCategories as SmartCategory[]).includes(value as SmartCategory)
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-gray-300 hover:bg-gray-800'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price Dropdown */}
        <div className="relative" ref={el => dropdownRefs.current['price'] = el}>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'price' ? null : 'price')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              'border flex items-center gap-2',
              (filters.priceRange.min > 0 || filters.priceRange.max < 500)
                ? 'bg-green-500/20 border-green-500 text-green-400'
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-green-400'
            )}
          >
            <span>Price</span>
            <svg className={clsx('w-4 h-4 transition-transform', openDropdown === 'price' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {openDropdown === 'price' && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-2">
              {PRICE_PRESETS.map(({ label, min, max }) => (
                <button
                  key={label}
                  onClick={() => {
                    onFilterChange({ priceRange: { min, max } });
                    setOpenDropdown(null);
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    filters.priceRange.min === min && filters.priceRange.max === max
                      ? 'bg-green-500/20 text-green-400'
                      : 'text-gray-300 hover:bg-gray-800'
                  )}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  onFilterChange({ priceRange: { min: 0, max: 500 } });
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-800"
              >
                Any Price
              </button>
            </div>
          )}
        </div>

        {/* Discount Dropdown */}
        <div className="relative" ref={el => dropdownRefs.current['discount'] = el}>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'discount' ? null : 'discount')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              'border flex items-center gap-2',
              filters.minDiscount > 0
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-red-400'
            )}
          >
            <span>Discount</span>
            <svg className={clsx('w-4 h-4 transition-transform', openDropdown === 'discount' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {openDropdown === 'discount' && (
            <div className="absolute top-full left-0 mt-2 w-36 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-2">
              {DISCOUNT_PRESETS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => {
                    onFilterChange({ minDiscount: value });
                    setOpenDropdown(null);
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    filters.minDiscount === value
                      ? 'bg-red-500/20 text-red-400'
                      : 'text-gray-300 hover:bg-gray-800'
                  )}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  onFilterChange({ minDiscount: 0 });
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-800"
              >
                Any Discount
              </button>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-700" />

        {/* Smart Filters */}
        <SmartFilter
          value={filters.smartFilters}
          onChange={(smartFilters) => onFilterChange({ smartFilters })}
        />

        {/* Product Count */}
        <div className="ml-auto text-sm text-gray-400">
          <span className="text-white font-semibold">{totalProducts.toLocaleString()}</span> products
        </div>
      </div>

      {/* Active Filters Row */}
      {activePills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-800">
          <span className="text-xs text-gray-500">Active:</span>
          {activePills.map((pill, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full"
            >
              {pill.label}
              <button
                onClick={pill.onRemove}
                className="hover:text-white transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          <button
            onClick={onReset}
            className="text-xs text-gray-400 hover:text-white transition-colors ml-2"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
