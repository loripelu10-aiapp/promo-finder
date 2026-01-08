/**
 * Region Selector Component
 *
 * Allows users to select their region to see relevant deals
 */

import React, { useState } from 'react';
import { Region, REGION_INFO } from '../types';
import { setUserRegion } from '../utils/regionDetection';

interface RegionSelectorProps {
  currentRegion: Region;
  onRegionChange: (region: Region) => void;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  currentRegion,
  onRegionChange
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleRegionSelect = (region: Region) => {
    setUserRegion(region);
    onRegionChange(region);
    setIsOpen(false);
  };

  const currentRegionInfo = REGION_INFO[currentRegion];

  // Available regions for users to select
  const availableRegions = [
    Region.EU,
    Region.UK,
    Region.US,
    Region.IT,
    Region.FR,
    Region.DE,
    Region.ES
  ];

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        aria-label="Select region"
      >
        <span className="text-2xl">{currentRegionInfo.flag}</span>
        <span className="font-medium text-gray-700">{currentRegionInfo.name}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="width" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">Select Your Region</h3>
              <p className="text-xs text-gray-500 mt-1">
                See deals available in your area
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {availableRegions.map((region) => {
                const info = REGION_INFO[region];
                const isSelected = region === currentRegion;

                return (
                  <button
                    key={region}
                    onClick={() => handleRegionSelect(region)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <span className="text-2xl">{info.flag}</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">{info.name}</div>
                      <div className="text-sm text-gray-500">
                        Currency: {info.currency} ({info.currencySymbol})
                      </div>
                    </div>
                    {isSelected && (
                      <svg
                        className="w-5 h-5 text-indigo-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                💡 Your selection is saved and will be remembered
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RegionSelector;
