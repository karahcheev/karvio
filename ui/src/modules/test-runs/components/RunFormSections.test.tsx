import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunMetadataFields } from "./RunFormSections";

describe("RunMetadataFields", () => {
  it("renders environment options with pinned revision labels", () => {
    render(
      <RunMetadataFields
        values={{
          name: "Nightly",
          description: "",
          environmentId: "",
          milestoneId: "",
          build: "",
          assignee: "unassigned",
        }}
        assigneeOptions={[]}
        environmentOptions={[
          { id: "env_1", label: "Staging", revisionNumber: 3 },
          { id: "env_2", label: "Prod-like", revisionNumber: null },
        ]}
        milestoneOptions={[]}
        onNameChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onEnvironmentChange={vi.fn()}
        onMilestoneChange={vi.fn()}
        onBuildChange={vi.fn()}
        onAssigneeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Staging · r3" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Prod-like" })).toBeInTheDocument();
    expect(screen.getByText("Optional. If selected, pinned to current revision when run is created")).toBeInTheDocument();
  });
});
