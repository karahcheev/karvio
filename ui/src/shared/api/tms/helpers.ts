import { apiRequest } from "@/shared/api/client";

type OffsetPage<T> = {
  items: T[];
  page: number;
  page_size: number;
  has_next: boolean;
};

export type ApiSortDirection = "asc" | "desc";

export type FetchAllPageItemsOptions = Readonly<{
  pageSize?: number;
  maxPages?: number;
  signal?: AbortSignal;
}>;

export async function fetchAllPageItems<T>(
  path: string,
  params?: URLSearchParams,
  options: FetchAllPageItemsOptions = {},
): Promise<T[]> {
  const items: T[] = [];
  const baseParams = params ? new URLSearchParams(params) : new URLSearchParams();
  const pageSize = options.pageSize ?? 200;
  const maxPages = options.maxPages ?? 50;
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    if (page > maxPages) {
      throw new Error(`Stopped fetching ${path}: reached ${maxPages} page limit.`);
    }
    const requestParams = new URLSearchParams(baseParams);
    requestParams.set("page_size", String(pageSize));
    requestParams.set("page", String(page));

    const query = requestParams.toString();
    const result = await apiRequest<OffsetPage<T>>(query ? `${path}?${query}` : path, {
      signal: options.signal,
    });
    items.push(...result.items);
    hasNext = result.has_next;
    page += 1;
  }

  return items;
}

export function extractFilenameFromDisposition(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return fallback;
    }
  }
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? fallback;
}

export async function downloadResponseAsFile(
  response: Response,
  fallback: string,
): Promise<void> {
  const blob = await response.blob();
  const filename = extractFilenameFromDisposition(
    response.headers.get("content-disposition"),
    fallback,
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function formatRelativeTime(value: string | null): string {
  if (!value) return "Never";
  const ms = Date.now() - new Date(value).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}
