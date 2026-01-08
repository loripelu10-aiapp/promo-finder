import React from 'react';
import clsx from 'clsx';
import { ProductCategory } from '../../../types';

interface CategoryFilterProps {
  selected: ProductCategory[];
  onChange: (categories: ProductCategory[]) => void;
  className?: string;
}

const categories = [
  { value: ProductCategory.ALL, label: 'All', icon: '🛍️' },
  { value: ProductCategory.CLOTHING, label: 'Clothing', icon: '👕' },
  { value: ProductCategory.SHOES, label: 'Shoes', icon: '👟' },
  { value: ProductCategory.ACCESSORIES, label: 'Accessories', icon: '👜' }
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selected,
  onChange,
  className
}) => {
  const handleToggle = (category: ProductCategory) => {
    if (category === ProductCategory.ALL) {
      onChange([ProductCategory.ALL]);
      return;
    }

    const newSelected = selected.filter(c => c !== ProductCategory.ALL);

    if (newSelected.includes(category)) {
      const filtered = newSelected.filter(c => c !== category);
      onChange(filtered.length === 0 ? [ProductCategory.ALL] : filtered);
    } else {
      onChange([...newSelected, category]);
    }
  };

  return (
    <div className={clsx('space-y-3', className)}>
      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Categories
      </h4>

      <div className="grid grid-cols-2 gap-2">
        {categories.map((category) => {
          const isSelected = selected.includes(category.value);

          return (
            <button
              key={category.value}
              onClick={() => handleToggle(category.value)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 rounded-lg border transition-all',
                'text-sm font-medium',
                isSelected
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-gray-800 bg-opacity-50 border-gray-700 text-gray-300 hover:border-gray-600'
              )}
            >
              <span className="text-lg">{category.icon}</span>
              <span>{category.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
