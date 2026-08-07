import { describe, it, expect } from "vitest";
import { titleForPath } from "./navbar-title";
import { SLUG_TO_VIEW } from "./slug-routes";

describe("titleForPath", () => {
  it("maps each known section path to its title", () => {
    expect(titleForPath("/programs")).toBe("Campaigns");
    expect(titleForPath("/campaigns/all")).toBe("Campaigns");
    expect(titleForPath("/campaigns/active")).toBe("Active Campaigns");
    expect(titleForPath("/campaigns/scheduled")).toBe("Scheduled Campaigns");
    expect(titleForPath("/campaigns/draft")).toBe("Draft Campaigns");
    expect(titleForPath("/campaigns/completed")).toBe("Completed Campaigns");
    expect(titleForPath("/campaigns/inactive")).toBe("Archived Campaigns");
    expect(titleForPath("/create/wizard")).toBe("Create Program");
    expect(titleForPath("/analytics")).toBe("Analytics");
    expect(titleForPath("/payout-management")).toBe("Payout Management");
    expect(titleForPath("/reports")).toBe("Reports");
    expect(titleForPath("/users")).toBe("Users List");
    expect(titleForPath("/users-directory")).toBe("Users Directory");
  });

  it("prefers the narrower path when two patterns overlap", () => {
    // /users would otherwise swallow /users-directory, and /programs would
    // swallow the per-programme analytics route.
    expect(titleForPath("/users-directory")).not.toBe("Users List");
    expect(titleForPath("/programs/abc-123/analytics")).toBe("Programme Analytics");
  });

  it("gives every sidebar destination a real title", () => {
    for (const path of Object.values(SLUG_TO_VIEW)) {
      expect(titleForPath(path), `no title for "${path}"`).not.toBe("Sales Incentive");
    }
  });

  it("matches paths with trailing segments / query", () => {
    expect(titleForPath("/analytics/detail")).toBe("Analytics");
    expect(titleForPath("/programs?filter=active")).toBe("Campaigns");
  });

  it("falls back to the product name for unknown / empty paths", () => {
    expect(titleForPath("/does-not-exist")).toBe("Sales Incentive");
    expect(titleForPath("")).toBe("Sales Incentive");
    expect(titleForPath(null)).toBe("Sales Incentive");
    expect(titleForPath(undefined)).toBe("Sales Incentive");
  });
});
