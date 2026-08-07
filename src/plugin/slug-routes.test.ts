import { describe, it, expect } from "vitest";
import { slugToPath, SLUG_TO_VIEW, DEFAULT_VIEW } from "@/plugin/slug-routes";

describe("slugToPath", () => {
  it("maps known slugs to internal routes", () => {
    expect(slugToPath("campaigns-all")).toBe("/campaigns/all");
    expect(slugToPath("campaigns-active")).toBe("/campaigns/active");
    expect(slugToPath("campaigns-scheduled")).toBe("/campaigns/scheduled");
    expect(slugToPath("campaigns-draft")).toBe("/campaigns/draft");
    expect(slugToPath("campaigns-completed")).toBe("/campaigns/completed");
    expect(slugToPath("campaigns-archived")).toBe("/campaigns/inactive");
    expect(slugToPath("clone-programs")).toBe("/programs");
    expect(slugToPath("wizard")).toBe("/create/wizard");
    expect(slugToPath("analytics")).toBe("/analytics");
    expect(slugToPath("payout-management")).toBe("/payout-management");
    expect(slugToPath("reports")).toBe("/reports");
    expect(slugToPath("users")).toBe("/users");
    expect(slugToPath("users-directory")).toBe("/users-directory");
  });

  it("falls back to the default view for unknown/empty slug", () => {
    expect(DEFAULT_VIEW).toBe("/campaigns/all");
    expect(slugToPath("nope")).toBe(DEFAULT_VIEW);
    expect(slugToPath(undefined)).toBe(DEFAULT_VIEW);
    expect(slugToPath(null)).toBe(DEFAULT_VIEW);
    expect(slugToPath("")).toBe(DEFAULT_VIEW);
  });

  it("no longer maps the routes main turned into redirects", () => {
    // /analytics/performance and /analytics/roi now bounce to /analytics, so
    // mapping a slug at them would put a redirect in the MemoryRouter history.
    expect(SLUG_TO_VIEW).not.toHaveProperty("performance");
    expect(SLUG_TO_VIEW).not.toHaveProperty("roi");
    expect(Object.values(SLUG_TO_VIEW)).not.toContain("/campaigns/drafts");
  });

  it("every mapped route is an absolute path", () => {
    for (const p of Object.values(SLUG_TO_VIEW)) {
      expect(p.startsWith("/")).toBe(true);
    }
  });
});
