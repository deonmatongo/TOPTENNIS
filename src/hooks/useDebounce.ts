import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms
 * of silence. Use it to avoid firing expensive operations (API calls, DB
 * queries) on every keystroke.
 *
 * @example
 * const debouncedQuery = useDebounce(searchInput, 350);
 * useEffect(() => { fetchResults(debouncedQuery); }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
