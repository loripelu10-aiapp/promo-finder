import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

interface SmartFilterState {
  bestValue: boolean;
  topDeal: boolean;
  priceDrop: boolean;
}

interface SmartFilterProps {
  value: SmartFilterState;
  onChange: (filters: SmartFilterState) => void;
}

const SMART_OPTIONS = [
  {
    key: 'bestValue' as keyof SmartFilterState,
    label: 'Best Value',
    description: '40%+ off from top brands',
    icon: '💎',
    color: 'emerald'
  },
  {
    key: 'topDeal' as keyof SmartFilterState,
    label: 'Top Deal',
    description: 'Highest deal quality score',
    icon: '🏆',
    color: 'amber'
  },
  {
    key: 'priceDrop' as keyof SmartFilterState,
    label: 'Price Drop',
    description: '50%+ discount',
    icon: '📉',
    color: 'red'
  }
];

export const SmartFilter: React.FC<SmartFilterProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeCount = Object.values(value).filter(Boolean).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFilter = (key: keyof SmartFilterState) => {
    onChange({ ...value, [key]: !value[key] });
  };

  const clearAll = () => {
    onChange({ bestValue: false, topDeal: false, priceDrop: false });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          'border flex items-center gap-2',
          activeCount > 0
            ? 'bg-purple-500/20 border-purple-500 text-purple-400'
            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-purple-400'
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>Smart Filters</span>
        {activeCount > 0 && (
          <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            {activeCount}
          </span>
        )}
        <svg
          className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">AI-Powered Filters</span>
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                Smart
              </span>
            </div>
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options */}
          <div className="p-2">
            {SMART_OPTIONS.map(({ key, label, description, icon, color }) => (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className={clsx(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-all',
                  'hover:bg-gray-800',
                  value[key] && `bg-${color}-500/10 border border-${color}-500/30`
                )}
              >
                <span className="text-2xl">{icon}</span>
                <div className="flex-1 text-left">
                  <div className={clsx(
                    'text-sm font-medium',
                    value[key] ? 'text-white' : 'text-gray-300'
                  )}>
                    {label}
                  </div>
                  <div className="text-xs text-gray-500">{description}</div>
                </div>
                <div className={clsx(
                  'w-10 h-6 rounded-full transition-colors relative',
                  value[key] ? 'bg-orange-500' : 'bg-gray-700'
                )}>
                  <div className={clsx(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    value[key] ? 'translate-x-5' : 'translate-x-1'
                  )} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
