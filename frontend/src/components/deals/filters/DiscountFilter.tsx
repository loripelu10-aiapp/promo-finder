import React from 'react';
import clsx from 'clsx';

interface DiscountFilterProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

const presets = [
  { label: 'Any', value: 0 },
  { label: '20%+', value: 20 },
  { label: '30%+', value: 30 },
  { label: '50%+', value: 50 },
  { label: '70%+', value: 70 }
];

export const DiscountFilter: React.FC<DiscountFilterProps> = ({
  value,
  onChange,
  className
}) => {
  return (
    <div className={clsx('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Minimum Discount
        </h4>
        <span className="text-sm font-bold text-orange-500">{value}%+</span>
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={80}
          step={5}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />

        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>20%</span>
          <span>40%</span>
          <span>60%</span>
          <span>80%</span>
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-5 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onChange(preset.value)}
            className={clsx(
              'px-2 py-1.5 rounded-md text-xs font-medium transition-all',
              value === preset.value
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 bg-opacity-50 text-gray-400 hover:bg-gray-700'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};
