import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Product, DealsFilters } from '../types';

interface UseDealsReturn {
  deals: Product[];
  loading: boolean;
  error: Error | null;
  total: number;
  lastUpdated: Date | null;
  refreshDeals: () => Promise<void>;
}

export function useDeals(
  filters?: Partial<DealsFilters>,
  page = 1,
  limit = 50
): UseDealsReturn {
  const [deals, setDeals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getDeals(filters, page, limit);
      setDeals(response.deals);
      setTotal(response.total);
      setLastUpdated(response.lastUpdated);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch deals'));
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return {
    deals,
    loading,
    error,
    total,
    lastUpdated,
    refreshDeals: fetchDeals
  };
}
