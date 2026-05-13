import { describe, expect, it } from "vitest";
import { filterSuitesForSearch } from "./suite-tree.utils";
import type { SuiteNode } from "../utils/types";

const suites: SuiteNode[] = [
  {
    id: "checkout",
    name: "Checkout",
    parent: null,
    count: 4,
    depth: 1,
    testCasesCount: 1,
  },
  {
    id: "payments",
    name: "Payments",
    parent: "checkout",
    count: 3,
    depth: 2,
    testCasesCount: 2,
  },
  {
    id: "refunds",
    name: "Refunds",
    parent: "payments",
    count: 1,
    depth: 3,
    testCasesCount: 1,
  },
  {
    id: "profile",
    name: "Profile",
    parent: null,
    count: 1,
    depth: 1,
    testCasesCount: 1,
  },
];

describe("filterSuitesForSearch", () => {
  it("keeps ancestors visible when a nested suite matches", () => {
    const filtered = filterSuitesForSearch(suites, "refund");

    expect(filtered.map((suite) => suite.id)).toEqual(["checkout", "payments", "refunds"]);
  });

  it("keeps descendants visible when a parent suite matches", () => {
    const filtered = filterSuitesForSearch(suites, "checkout");

    expect(filtered.map((suite) => suite.id)).toEqual(["checkout", "payments", "refunds"]);
  });

  it("returns all suites when search is empty", () => {
    const filtered = filterSuitesForSearch(suites, "  ");

    expect(filtered).toBe(suites);
  });
});
