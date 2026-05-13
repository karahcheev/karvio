import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestCaseAiReviewPanel } from "./TestCaseAiReviewPanel";

const review = {
  quality_score: 82,
  summary: "The case is useful but needs sharper steps.",
  issues: [
    {
      severity: "medium" as const,
      field: "steps" as const,
      problem: "Expected result is too broad.",
      recommendation: "Name the expected UI state.",
    },
  ],
  suggested_revision: {
    title: "Sharper checkout case",
    preconditions: null,
    steps: [{ action: "Submit payment", expected_result: "Receipt is shown" }],
    priority: "high" as const,
    tags: ["checkout"],
    component_coverages: null,
  },
  missing_edge_cases: ["Expired card"],
  automation_readiness: {
    score: 70,
    blocking_issues: [],
    recommendations: ["Mock the gateway"],
  },
};

describe("TestCaseAiReviewPanel", () => {
  it("renders grouped review issues and suggested actions", async () => {
    const onRunReview = vi.fn();
    const onApplyField = vi.fn();

    render(
      <TestCaseAiReviewPanel
        review={review}
        isReviewing={false}
        onRunReview={onRunReview}
        onApplyField={onApplyField}
      />
    );

    expect(screen.getByText("82 quality score")).toBeInTheDocument();
    expect(screen.getByText("Expected result is too broad.")).toBeInTheDocument();
    expect(screen.getByText("Expired card")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /apply title/i }));
    expect(onApplyField).toHaveBeenCalledWith("title");
  });

  it("renders loading state", () => {
    render(
      <TestCaseAiReviewPanel
        review={null}
        isReviewing
        onRunReview={vi.fn()}
        onApplyField={vi.fn()}
      />
    );

    expect(screen.getByText("Generating review...")).toBeInTheDocument();
  });
});

