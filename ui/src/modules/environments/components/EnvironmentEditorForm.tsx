export type EnvironmentHostPlacement = "load_generators" | "system_under_test" | "supporting_services";

export type EnvironmentHostDraft = {
  id: string;
  name: string;
  placement: EnvironmentHostPlacement;
  hostType: string;
  componentName: string;
  componentType: string;
  role: string;
  provider: string;
  region: string;
  endpoint: string;
  count: string;
  tagsText: string;
  componentEndpointsText: string;
  componentTagsText: string;
  resourcesJson: string;
  metadataJson: string;
  componentMetadataJson: string;
};

export type EnvironmentDraft = {
  name: string;
  kind: string;
  status: string;
  description: string;
  tagsText: string;
  useCasesText: string;
  hosts: EnvironmentHostDraft[];
  metaJson: string;
  extraJson: string;
};

export const ENVIRONMENT_HOST_TYPE_OPTIONS = [
  "vm",
  "container",
  "baremetal",
  "cloud_service",
  "kubernetes",
] as const;

export const ENVIRONMENT_HOST_PLACEMENT_OPTIONS: Array<{
  value: EnvironmentHostPlacement;
  label: string;
}> = [
  { value: "system_under_test", label: "System Under Test" },
  { value: "supporting_services", label: "Supporting Services" },
  { value: "load_generators", label: "Load Generators" },
];

function createHostId(): string {
  return `host_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyEnvironmentHostDraft(): EnvironmentHostDraft {
  return {
    id: createHostId(),
    name: "",
    placement: "system_under_test",
    hostType: "vm",
    componentName: "",
    componentType: "",
    role: "",
    provider: "",
    region: "",
    endpoint: "",
    count: "1",
    tagsText: "",
    componentEndpointsText: "",
    componentTagsText: "",
    resourcesJson: "{}",
    metadataJson: "{}",
    componentMetadataJson: "{}",
  };
}

export function cloneEnvironmentHostDraft(host: EnvironmentHostDraft): EnvironmentHostDraft {
  return {
    ...host,
    id: createHostId(),
  };
}

export function placementLabel(value: EnvironmentHostPlacement): string {
  return ENVIRONMENT_HOST_PLACEMENT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
