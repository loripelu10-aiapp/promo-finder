import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder,
  className
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleClear = () => {
    onChange('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.();
  };

  return (
    <form onSubmit={handleSubmit} className={clsx('relative', className)}>
      <div className="relative flex items-center">
        <div className="absolute left-4 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
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

        <input
          id="search-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Search brands, products, styles...'}
          className={clsx(
            'w-full pl-12 pr-24 py-3 bg-gray-800 bg-opacity-50 border border-gray-700',
            'rounded-xl text-white placeholder-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent',
            'transition-all duration-200'
          )}
        />

        <div className="absolute right-2 flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-700 rounded">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>
    </form>
  );
};
