import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./login-utils";

describe("safeReturnPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeReturnPath("/projects/123/overview")).toBe("/projects/123/overview");
    expect(safeReturnPath("/")).toBe("/");
  });

  it("rejects absolute and protocol-relative URLs (open-redirect protection)", () => {
    expect(safeReturnPath("https://evil.example.com")).toBe("/");
    expect(safeReturnPath("//evil.example.com")).toBe("/");
    expect(safeReturnPath("javascript:alert(1)")).toBe("/");
  });

  it("falls back to root for empty input", () => {
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath("")).toBe("/");
  });
});
