import React, { useState } from 'react';
import clsx from 'clsx';

interface BrandFilterProps {
  selected: string[];
  onChange: (brands: string[]) => void;
  className?: string;
}

const popularBrands = [
  'Nike',
  'Adidas',
  'Zara',
  'H&M',
  'ASOS',
  'Uniqlo',
  'Mango',
  'Pull&Bear',
  'Bershka',
  'Stradivarius'
];

export const BrandFilter: React.FC<BrandFilterProps> = ({
  selected,
  onChange,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBrands = popularBrands.filter(brand =>
    brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (brand: string) => {
    if (selected.includes(brand)) {
      onChange(selected.filter(b => b !== brand));
    } else {
      onChange([...selected, brand]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className={clsx('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Brands
        </h4>
        {selected.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-orange-500 hover:text-orange-400"
          >
            Clear ({selected.length})
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search brands..."
          className={clsx(
            'w-full pl-9 pr-4 py-2 bg-gray-800 bg-opacity-50 border border-gray-700',
            'rounded-lg text-sm text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-orange-500'
          )}
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Brand List */}
      <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
        {filteredBrands.map((brand) => {
          const isSelected = selected.includes(brand);

          return (
            <label
              key={brand}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                isSelected
                  ? 'bg-orange-500 bg-opacity-20 text-white'
                  : 'hover:bg-gray-800 text-gray-300'
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(brand)}
                className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
              />
              <span className="text-sm font-medium">{brand}</span>
            </label>
          );
        })}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.8);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.9);
        }
      `}</style>
    </div>
  );
};
