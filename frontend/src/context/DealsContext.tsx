import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { Product, DealsFilters, DEFAULT_FILTERS } from '../types';
import { getUserRegion } from '../utils/regionDetection';

interface DealsContextValue {
  deals: Product[];
  filters: DealsFilters;
  isLoading: boolean;
  error: Error | null;
  total: number;
  lastUpdated: Date | null;
  updateFilters: (filters: Partial<DealsFilters>) => void;
  resetFilters: () => void;
  refreshDeals: () => Promise<void>;
  setSearchQuery: (query: string) => void;
}

const DealsContext = createContext<DealsContextValue | undefined>(undefined);

export const useDealsContext = () => {
  const context = useContext(DealsContext);
  if (!context) {
    throw new Error('useDealsContext must be used within DealsProvider');
  }
  return context;
};

interface DealsProviderProps {
  children: React.ReactNode;
}

export const DealsProvider: React.FC<DealsProviderProps> = ({ children }) => {
  const [deals, setDeals] = useState<Product[]>([]);
  const [filters, setFilters] = useState<DealsFilters>({
    region: getUserRegion(), // Auto-detect or use stored region
    brands: [],
    categories: ['all' as any],
    priceRange: { min: 0, max: 500 },
    minDiscount: 0,
    minConfidence: 70,
    sources: [],
    sortBy: 'relevance',
    sortOrder: 'desc'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDeals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getDeals(filters, 1, 50);
      setDeals(response.deals);
      setTotal(response.total);
      setLastUpdated(response.lastUpdated);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch deals'));
      setDeals([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const updateFilters = useCallback((newFilters: Partial<DealsFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(prev => ({
      region: prev.region, // Keep the current region
      brands: [],
      categories: ['all' as any],
      priceRange: { min: 0, max: 500 },
      minDiscount: 0,
      minConfidence: 70,
      sources: [],
      sortBy: 'relevance',
      sortOrder: 'desc'
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    updateFilters({ searchQuery: query });
  }, [updateFilters]);

  const value: DealsContextValue = {
    deals,
    filters,
    isLoading,
    error,
    total,
    lastUpdated,
    updateFilters,
    resetFilters,
    refreshDeals: fetchDeals,
    setSearchQuery
  };

  return <DealsContext.Provider value={value}>{children}</DealsContext.Provider>;
};
