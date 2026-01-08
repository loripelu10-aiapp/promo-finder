import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { RegionSelector } from '../RegionSelector';
import { useDealsContext } from '../../context/DealsContext';
import type { Region } from '../../types';

interface HeaderProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, showMenu = false }) => {
  const { i18n } = useTranslation();
  const { filters, updateFilters } = useDealsContext();

  const handleRegionChange = (region: Region) => {
    updateFilters({ region });
  };

  const languages = [
    { code: 'en', flag: '🇬🇧', name: 'English' },
    { code: 'it', flag: '🇮🇹', name: 'Italiano' },
    { code: 'es', flag: '🇪🇸', name: 'Español' },
    { code: 'fr', flag: '🇫🇷', name: 'Français' },
    { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
    { code: 'pt', flag: '🇵🇹', name: 'Português' }
  ];

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  return (
    <header className="sticky top-0 z-40 bg-gray-900 bg-opacity-90 backdrop-blur-lg border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-4">
            {showMenu && (
              <button
                onClick={onMenuClick}
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <span className="text-xl font-bold">
                <span className="text-white">PROMO</span>
                <span className="text-orange-500">FINDER</span>
              </span>
            </a>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="/" className="text-gray-300 hover:text-white transition-colors font-medium">
              Deals
            </a>
            <a href="/analytics" className="text-gray-300 hover:text-white transition-colors font-medium">
              Analytics
            </a>
            <a href="/about" className="text-gray-300 hover:text-white transition-colors font-medium">
              About
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Region Selector */}
            {filters.region && (
              <RegionSelector
                currentRegion={filters.region}
                onRegionChange={handleRegionChange}
              />
            )}

            {/* Language Selector */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                <span className="text-lg">{currentLang.flag}</span>
                <span className="hidden sm:inline text-sm text-gray-300">{currentLang.code.toUpperCase()}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-700 transition-colors',
                      i18n.language === lang.code && 'bg-orange-500 bg-opacity-20'
                    )}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="text-sm text-gray-300">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
