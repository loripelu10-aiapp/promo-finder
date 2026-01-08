import { useState, useCallback } from 'react';
import { DealsFilters, DEFAULT_FILTERS } from '../types';

interface UseFiltersReturn {
  filters: DealsFilters;
  updateFilters: (newFilters: Partial<DealsFilters>) => void;
  resetFilters: () => void;
  setFilter: <K extends keyof DealsFilters>(key: K, value: DealsFilters[K]) => void;
}

export function useFilters(initialFilters?: Partial<DealsFilters>): UseFiltersReturn {
  const [filters, setFilters] = useState<DealsFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters
  });

  const updateFilters = useCallback((newFilters: Partial<DealsFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const setFilter = useCallback(<K extends keyof DealsFilters>(
    key: K,
    value: DealsFilters[K]
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  return {
    filters,
    updateFilters,
    resetFilters,
    setFilter
  };
}
