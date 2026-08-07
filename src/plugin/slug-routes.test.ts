import { describe, it, expect } from "vitest";
import { slugToPath, SLUG_TO_VIEW } from "@/plugin/slug-routes";

describe("slugToPath", () => {
  it("maps known slugs to internal routes", () => {
    expect(slugToPath("programs")).toBe("/programs");
    expect(slugToPath("campaigns-completed")).toBe("/campaigns/completed");
    expect(slugToPath("campaigns-drafts")).toBe("/campaigns/drafts");
    expect(slugToPath("clone-programs")).toBe("/programs");
    expect(slugToPath("wizard")).toBe("/create/wizard");
    expect(slugToPath("performance")).toBe("/analytics/performance");
    expect(slugToPath("roi")).toBe("/analytics/roi");
    expect(slugToPath("reports")).toBe("/reports");
    expect(slugToPath("users")).toBe("/users");
  });

  it("falls back to /programs for unknown/empty slug", () => {
    expect(slugToPath("nope")).toBe("/programs");
    expect(slugToPath(undefined)).toBe("/programs");
    expect(slugToPath(null)).toBe("/programs");
    expect(slugToPath("")).toBe("/programs");
  });

  it("every mapped route is an absolute path", () => {
    for (const p of Object.values(SLUG_TO_VIEW)) {
      expect(p.startsWith("/")).toBe(true);
    }
  });
});
