import { useQueryClient } from "@tanstack/react-query";

export function invalidateGroups(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKeyGroups: ReadonlyArray<readonly unknown[]>,
) {
  return Promise.all(queryKeyGroups.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
