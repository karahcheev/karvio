import { useEffect, useState } from "react";

/** Default pause (ms) after typing before list/search requests use the query string. */
export const LIST_SEARCH_DEBOUNCE_MS = 450;

/**
 * Returns a debounced version of the value. Updates after `delayMs` of no changes.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
