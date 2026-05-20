/**
 * Only same-origin relative paths are accepted as a post-login return target.
 * Anything else (absolute URLs, protocol-relative `//host`, missing value)
 * falls back to "/" to prevent open-redirect attacks.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
