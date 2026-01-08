import React from 'react';
import clsx from 'clsx';

interface PriceRangeSliderProps {
  min: number;
  max: number;
  value: { min: number; max: number };
  onChange: (value: { min: number; max: number }) => void;
  className?: string;
}

export const PriceRangeSlider: React.FC<PriceRangeSliderProps> = ({
  min,
  max,
  value,
  onChange,
  className
}) => {
  return (
    <div className={clsx('space-y-3', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Price Range</span>
        <span className="font-medium text-white">
          €{value.min} - €{value.max}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">Min Price: €{value.min}</label>
          <input
            type="range"
            min={min}
            max={max}
            value={value.min}
            onChange={(e) => onChange({ ...value, min: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Max Price: €{value.max}</label>
          <input
            type="range"
            min={min}
            max={max}
            value={value.max}
            onChange={(e) => onChange({ ...value, max: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>
      </div>
    </div>
  );
};
