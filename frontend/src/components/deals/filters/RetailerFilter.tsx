import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

interface RetailerCount {
  name: string;
  count: number;
}

interface RetailerFilterProps {
  retailers: RetailerCount[];
  selected: string[];
  onChange: (retailers: string[]) => void;
}

export const RetailerFilter: React.FC<RetailerFilterProps> = ({
  retailers,
  selected,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleRetailer = (retailer: string) => {
    if (selected.includes(retailer)) {
      onChange(selected.filter(r => r !== retailer));
    } else {
      onChange([...selected, retailer]);
    }
  };

  const selectAll = () => {
    onChange(retailers.map(r => r.name));
  };

  const clearAll = () => {
    onChange([]);
  };

  // Sort retailers by count (descending)
  const sortedRetailers = [...retailers].sort((a, b) => b.count - a.count);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          'border flex items-center gap-2',
          selected.length > 0
            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-orange-400'
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span>Retailers</span>
        {selected.length > 0 && (
          <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            {selected.length}
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
        <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Select Retailers</span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                All
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={clearAll}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Retailer List */}
          <div className="max-h-64 overflow-y-auto p-2">
            {sortedRetailers.map(({ name, count }) => (
              <label
                key={name}
                className={clsx(
                  'flex items-center justify-between p-2 rounded-lg cursor-pointer',
                  'hover:bg-gray-800 transition-colors',
                  selected.includes(name) && 'bg-orange-500/10'
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(name)}
                    onChange={() => toggleRetailer(name)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                  />
                  <span className={clsx(
                    'text-sm',
                    selected.includes(name) ? 'text-white font-medium' : 'text-gray-300'
                  )}>
                    {name}
                  </span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  {count}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
