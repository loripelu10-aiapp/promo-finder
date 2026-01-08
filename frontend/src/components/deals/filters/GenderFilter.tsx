import React from 'react';
import clsx from 'clsx';
import type { Gender } from '../../../types';

interface GenderFilterProps {
  selected: Gender[];
  onChange: (genders: Gender[]) => void;
}

const GENDERS: { value: Gender; label: string; icon: string }[] = [
  { value: 'men', label: 'Men', icon: '👔' },
  { value: 'women', label: 'Women', icon: '👗' },
  { value: 'kids', label: 'Kids', icon: '🧒' },
  { value: 'unisex', label: 'Unisex', icon: '✨' }
];

export const GenderFilter: React.FC<GenderFilterProps> = ({ selected, onChange }) => {
  const toggleGender = (gender: Gender) => {
    if (selected.includes(gender)) {
      onChange(selected.filter(g => g !== gender));
    } else {
      onChange([...selected, gender]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {GENDERS.map(({ value, label, icon }) => (
        <button
          key={value}
          onClick={() => toggleGender(value)}
          className={clsx(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
            'border flex items-center gap-1.5',
            selected.includes(value)
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-orange-400 hover:text-white'
          )}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};
