import { apiRequest } from "@/shared/api/client";
import type { VersionDto } from "./types";

export async function getVersion(): Promise<VersionDto> {
  return apiRequest<VersionDto>("/version");
}
