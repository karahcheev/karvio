import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EnvironmentDto } from "@/shared/api";
import { EnvironmentDetailsSidePanel } from "./EnvironmentDetailsSidePanel";

const baseEnvironment: EnvironmentDto = {
  id: "env_1",
  project_id: "proj_1",
  name: "Registry Env",
  kind: "custom",
  status: "active",
  description: "Environment for regression",
  tags: ["prod-like"],
  use_cases: ["functional", "performance"],
  schema_version: 1,
  topology: {
    load_generators: [],
    system_under_test: [
      {
        name: "checkout-api",
        component_type: "api",
        nodes: [
          {
            name: "api-node",
            host_type: "vm",
            role: "service",
            provider: "aws",
            region: "eu-central-1",
            endpoint: "https://example.local",
            count: 2,
            resources: {},
            tags: ["sut"],
            metadata: {},
          },
        ],
        endpoints: ["/checkout"],
        tags: ["critical"],
        metadata: {},
      },
    ],
    supporting_services: [],
    metadata: {},
  },
  meta: {},
  extra: {},
  current_revision_number: 4,
  current_revision_id: "rev_4",
  snapshot_hash: "hash_4",
  entities_count: 7,
  edges_count: 6,
  topology_component_count: 1,
  topology_node_count: 2,
  topology_endpoint_count: 1,
  infra_host_types: ["vm"],
  infra_providers: ["aws"],
  infra_regions: ["eu-central-1"],
  created_by: "user_1",
  updated_by: "user_1",
  archived_at: null,
  created_at: "2026-04-01T10:00:00Z",
  updated_at: "2026-04-02T11:00:00Z",
};

describe("EnvironmentDetailsSidePanel", () => {
  it("renders structured overview/topology/revisions sections", () => {
    render(
      <EnvironmentDetailsSidePanel
        environment={baseEnvironment}
        revisions={[
          {
            id: "rev_4",
            environment_id: "env_1",
            revision_number: 4,
            schema_version: 1,
            is_current: true,
            revision_note: "Current",
            full_snapshot: { environment: { name: "Registry Env" }, topology: {} },
            snapshot_hash: "hash_4",
            extra: {},
            entities: [],
            edges: [],
            created_by: "user_1",
            created_at: "2026-04-02T11:00:00Z",
          },
        ]}
        onClose={vi.fn()}
        onEditStart={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Topology")).toBeInTheDocument();
    expect(screen.getByText("Revisions")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    expect(screen.getByText("checkout-api")).toBeInTheDocument();
    expect(screen.getByText("Revision r4 (current)")).toBeInTheDocument();
  });
});
