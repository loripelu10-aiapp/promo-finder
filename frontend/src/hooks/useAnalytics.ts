import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AnalyticsStats } from '../types';

interface UseAnalyticsReturn {
  stats: AnalyticsStats | null;
  loading: boolean;
  error: Error | null;
  refreshStats: () => Promise<void>;
}

export function useAnalytics(): UseAnalyticsReturn {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch analytics'));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refreshStats: fetchStats
  };
}
