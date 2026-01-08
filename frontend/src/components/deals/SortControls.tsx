import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { SortOption } from '../../types';

interface SortControlsProps {
  sortBy: SortOption;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: SortOption) => void;
  onOrderChange: (order: 'asc' | 'desc') => void;
  className?: string;
}

export const SortControls: React.FC<SortControlsProps> = ({
  sortBy,
  sortOrder,
  onSortChange,
  onOrderChange,
  className
}) => {
  const { t } = useTranslation();

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'price', label: 'Price' },
    { value: 'discount', label: 'Discount' },
    { value: 'date', label: 'Newest' },
    { value: 'popularity', label: 'Popularity' }
  ];

  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <label className="text-sm text-gray-400 font-medium">Sort by:</label>

      <div className="flex items-center gap-2">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className={clsx(
            'px-4 py-2 bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg',
            'text-white text-sm font-medium cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-orange-500',
            'transition-all duration-200'
          )}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => onOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          className={clsx(
            'p-2 bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg',
            'text-white hover:bg-gray-700 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-orange-500'
          )}
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
