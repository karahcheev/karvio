import type { SuiteNode } from "../utils/types";

export type SuiteMeta = {
  childrenByParent: Map<string | null, SuiteNode[]>;
  getAggregateCount: (suiteId: string) => number;
  getDepth: (suiteId: string, trail?: Set<string>) => number;
  getDescendants: (suiteId: string) => Set<string>;
};

export function buildSuiteMeta(
  suites: SuiteNode[],
  directActiveCountsBySuiteId: Map<string, number>,
): SuiteMeta {
  const childrenByParent = new Map<string | null, SuiteNode[]>();
  const suiteMap = new Map<string, SuiteNode>();
  for (const suite of suites) {
    suiteMap.set(suite.id, suite);
    const key = suite.parent;
    const children = childrenByParent.get(key) ?? [];
    children.push(suite);
    childrenByParent.set(key, children);
  }

  const depthMemo = new Map<string, number>();
  const getDepth = (suiteId: string, trail = new Set<string>()): number => {
    if (depthMemo.has(suiteId)) return depthMemo.get(suiteId)!;
    if (trail.has(suiteId)) return 1;
    const suite = suiteMap.get(suiteId);
    if (!suite?.parent) {
      depthMemo.set(suiteId, 1);
      return 1;
    }
    trail.add(suiteId);
    const depth = getDepth(suite.parent, trail) + 1;
    trail.delete(suiteId);
    depthMemo.set(suiteId, depth);
    return depth;
  };

  const descendantsMemo = new Map<string, Set<string>>();
  const getDescendants = (suiteId: string): Set<string> => {
    if (descendantsMemo.has(suiteId)) return descendantsMemo.get(suiteId)!;
    const descendants = new Set<string>([suiteId]);
    for (const child of childrenByParent.get(suiteId) ?? []) {
      for (const childId of getDescendants(child.id)) descendants.add(childId);
    }
    descendantsMemo.set(suiteId, descendants);
    return descendants;
  };

  const countMemo = new Map<string, number>();
  const getAggregateCount = (suiteId: string): number => {
    if (countMemo.has(suiteId)) return countMemo.get(suiteId)!;
    let count = directActiveCountsBySuiteId.get(suiteId) ?? 0;
    for (const child of childrenByParent.get(suiteId) ?? []) count += getAggregateCount(child.id);
    countMemo.set(suiteId, count);
    return count;
  };

  return { childrenByParent, getAggregateCount, getDepth, getDescendants };
}

export function getSelectedSuiteIdsForFilter(
  selectedSuite: string | null,
  suitesData: { id: string; parent_id: string | null }[] | undefined,
): Set<string> | null {
  if (!selectedSuite || !suitesData) return null;
  const childrenByParent = new Map<string | null, typeof suitesData>();
  for (const suite of suitesData) {
    const key = suite.parent_id;
    const children = childrenByParent.get(key) ?? [];
    children.push(suite);
    childrenByParent.set(key, children);
  }
  const getDescendants = (suiteId: string): Set<string> => {
    const descendants = new Set<string>([suiteId]);
    for (const child of childrenByParent.get(suiteId) ?? []) {
      for (const id of getDescendants(child.id)) descendants.add(id);
    }
    return descendants;
  };
  return getDescendants(selectedSuite);
}

export function filterSuitesForSearch(suites: SuiteNode[], searchQuery: string): SuiteNode[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return suites;

  const suitesById = new Map<string, SuiteNode>();
  const childrenByParent = new Map<string | null, SuiteNode[]>();
  for (const suite of suites) {
    suitesById.set(suite.id, suite);
    const children = childrenByParent.get(suite.parent) ?? [];
    children.push(suite);
    childrenByParent.set(suite.parent, children);
  }

  const visibleSuiteIds = new Set<string>();

  const addAncestors = (suite: SuiteNode) => {
    let parentId = suite.parent;
    while (parentId) {
      const parent = suitesById.get(parentId);
      if (!parent) break;
      visibleSuiteIds.add(parent.id);
      parentId = parent.parent;
    }
  };

  const addDescendants = (suiteId: string) => {
    for (const child of childrenByParent.get(suiteId) ?? []) {
      visibleSuiteIds.add(child.id);
      addDescendants(child.id);
    }
  };

  for (const suite of suites) {
    if (!suite.name.toLowerCase().includes(query)) continue;
    visibleSuiteIds.add(suite.id);
    addAncestors(suite);
    addDescendants(suite.id);
  }

  return suites.filter((suite) => visibleSuiteIds.has(suite.id));
}
