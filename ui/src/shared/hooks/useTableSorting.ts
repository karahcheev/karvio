import { useState } from "react";
import type { UnifiedTableSorting } from "@/shared/ui/Table";

export function useTableSorting<TColumn extends string>(initialSorting: UnifiedTableSorting<TColumn>) {
  const [sorting, setSorting] = useState<UnifiedTableSorting<TColumn>>(initialSorting);
  return { sorting, setSorting };
}
