import { useState, useEffect, useCallback } from 'react';

interface UseSearchReturn {
  query: string;
  debouncedQuery: string;
  setQuery: (query: string) => void;
  clearQuery: () => void;
}

export function useSearch(
  onSearch?: (query: string) => void,
  debounceMs = 300
): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      if (onSearch && query.trim()) {
        onSearch(query.trim());
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [query, debounceMs, onSearch]);

  const clearQuery = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    debouncedQuery,
    setQuery,
    clearQuery
  };
}
