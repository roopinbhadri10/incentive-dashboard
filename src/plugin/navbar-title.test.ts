import { describe, it, expect } from "vitest";
import { titleForPath } from "./navbar-title";

describe("titleForPath", () => {
  it("maps each known section path to its title", () => {
    expect(titleForPath("/programs")).toBe("Campaigns");
    expect(titleForPath("/campaigns/completed")).toBe("Completed Campaigns");
    expect(titleForPath("/campaigns/drafts")).toBe("Draft Campaigns");
    expect(titleForPath("/create/wizard")).toBe("Create Program");
    expect(titleForPath("/analytics/performance")).toBe("Performance");
    expect(titleForPath("/analytics/roi")).toBe("ROI Analysis");
    expect(titleForPath("/reports")).toBe("Reports");
    expect(titleForPath("/users")).toBe("Users List");
  });

  it("matches paths with trailing segments / query", () => {
    expect(titleForPath("/analytics/performance/detail")).toBe("Performance");
    expect(titleForPath("/programs?filter=active")).toBe("Campaigns");
  });

  it("falls back to the product name for unknown / empty paths", () => {
    expect(titleForPath("/does-not-exist")).toBe("Sales Incentive");
    expect(titleForPath("")).toBe("Sales Incentive");
    expect(titleForPath(null)).toBe("Sales Incentive");
    expect(titleForPath(undefined)).toBe("Sales Incentive");
  });
});
