import { clearSession } from "@/shared/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
const inflightGetRequests = new Map<string, Promise<unknown>>();

type ProblemResponse = {
  detail?: unknown;
  errors?: Record<string, unknown>;
};

function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  // Token is sent via httpOnly cookie; credentials: 'include' in fetch options

  const body = init?.body;
  const shouldSetJsonContentType =
    body !== undefined && body !== null && !(body instanceof FormData) && !headers.has("Content-Type");

  if (shouldSetJsonContentType) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function extractProblemMessage(body: ProblemResponse | null): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  if (body.errors && typeof body.errors === "object") {
    for (const value of Object.values(body.errors)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
        return value[0];
      }
      if (typeof value === "string") {
        return value;
      }
    }
  }

  if (typeof body.detail === "string" && body.detail.trim()) {
    return body.detail;
  }

  return null;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init),
  });

  if (!response.ok) {
    if (response.status === 401) {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
      clearSession();
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    let message: string | null = null;

    if (contentType.includes("application/json")) {
      const body = (await response.json().catch(() => null)) as ProblemResponse | null;
      message = extractProblemMessage(body);
    }

    if (!message) {
      const text = await response.text().catch(() => "");
      message = text || `Request failed: ${response.status}`;
    }

    throw new Error(message);
  }

  return response;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const canDedupeGet = method === "GET" && !init?.signal;
  const key = canDedupeGet ? `${method}:${path}` : null;

  if (key) {
    const existing = inflightGetRequests.get(key);
    if (existing) {
      return (await existing) as T;
    }
  }

  const executeRequest = async (): Promise<T> => {
    const response = await apiFetch(path, init);
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  };

  if (!key) {
    return executeRequest();
  }

  const requestPromise = executeRequest().finally(() => {
    inflightGetRequests.delete(key);
  });
  inflightGetRequests.set(key, requestPromise);
  return (await requestPromise) as T;
}
