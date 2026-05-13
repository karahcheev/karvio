import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

type UseUrlHashStateOptions<T extends string> = {
  defaultValue: T;
  omitHashFor?: T;
  replace?: boolean;
  values: readonly T[];
};

function getHashValue<T extends string>(hash: string, values: readonly T[], defaultValue: T): T {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  return values.includes(normalizedHash as T) ? (normalizedHash as T) : defaultValue;
}

function toHash<T extends string>(value: T, omitHashFor?: T): string {
  return value === omitHashFor ? "" : `#${value}`;
}

export function useUrlHashState<T extends string>({
  defaultValue,
  omitHashFor,
  replace = true,
  values,
}: UseUrlHashStateOptions<T>): readonly [T, (next: T) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  const value = getHashValue(location.hash, values, defaultValue);

  const setValue = useCallback(
    (next: T) => {
      const nextHash = toHash(next, omitHashFor);
      if (location.hash === nextHash) {
        return;
      }

      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: nextHash,
        },
        { replace }
      );
    },
    [location.hash, location.pathname, location.search, navigate, omitHashFor, replace]
  );

  useEffect(() => {
    const canonicalHash = toHash(value, omitHashFor);
    if (location.hash === canonicalHash) {
      return;
    }

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: canonicalHash,
      },
      { replace }
    );
  }, [location.hash, location.pathname, location.search, navigate, omitHashFor, replace, value]);

  return [value, setValue] as const;
}
