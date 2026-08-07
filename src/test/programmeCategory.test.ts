import { describe, it, expect } from "vitest";
import { programmeCategory } from "@/pages/ProgramsPage";
import type { Programme } from "@/types/programme";

/** Minimal Programme — only the fields the categoriser reads matter. */
function prog(over: Partial<Programme> = {}): Programme {
  return {
    id: "r1",
    name: "Test",
    status: "active",
    channel: "CCD",
    role: "MR",
    segment: "all",
    geography: "all-india",
    period: { month: 8, year: 2026, isQ1: false },
    effectiveFrom: "2026-08-01",
    effectiveTill: "2026-08-31",
    kpis: {},
    gates: {},
    maxMonthlyEarning: 0,
    createdAt: "2026-08-01T00:00:00",
    updatedAt: "2026-08-01T00:00:00",
    ...over,
  } as Programme;
}

const on = (iso: string) => new Date(`${iso}T12:00:00`);

describe("programmeCategory", () => {
  it("is Active when today sits inside the effective window", () => {
    expect(programmeCategory(prog(), on("2026-08-15"))).toBe("active");
  });

  it("is Scheduled when today is before effectiveFrom", () => {
    expect(programmeCategory(prog(), on("2026-07-31"))).toBe("scheduled");
  });

  it("is Completed when today is after effectiveTill", () => {
    expect(programmeCategory(prog(), on("2026-09-01"))).toBe("completed");
  });

  it("treats both window edges as inclusive", () => {
    // First day of the window is already Active, not Scheduled.
    expect(programmeCategory(prog(), on("2026-08-01"))).toBe("active");
    // Last day is still Active, not Completed.
    expect(programmeCategory(prog(), on("2026-08-31"))).toBe("active");
  });

  it("compares whole days, so time of day never flips the category", () => {
    expect(programmeCategory(prog(), new Date("2026-08-31T23:59:59"))).toBe("active");
    expect(programmeCategory(prog(), new Date("2026-08-01T00:00:00"))).toBe("active");
  });

  it("is Archived when the programme is switched off, whatever the dates say", () => {
    // Dates say Active, but isActive:false (status "inactive") wins.
    expect(programmeCategory(prog({ status: "inactive" }), on("2026-08-15"))).toBe("inactive");
    // ...and also when the window is in the future.
    expect(programmeCategory(prog({ status: "inactive" }), on("2026-01-01"))).toBe("inactive");
  });

  it("ignores the stored status when a usable window is present", () => {
    // A rule still marked DRAFT by the engine but inside its window reads Active.
    expect(programmeCategory(prog({ status: "draft" }), on("2026-08-15"))).toBe("active");
  });

  it("handles an open-ended window", () => {
    const noTill = prog({ effectiveTill: undefined });
    expect(programmeCategory(noTill, on("2030-01-01"))).toBe("active");
    expect(programmeCategory(noTill, on("2026-07-01"))).toBe("scheduled");

    const noFrom = prog({ effectiveFrom: undefined });
    expect(programmeCategory(noFrom, on("2020-01-01"))).toBe("active");
    expect(programmeCategory(noFrom, on("2026-09-01"))).toBe("completed");
  });

  it("falls back to the stored status when the window is missing or unparseable", () => {
    const noDates = { effectiveFrom: undefined, effectiveTill: undefined };
    expect(programmeCategory(prog({ ...noDates, status: "active" }), on("2026-08-15"))).toBe("active");
    expect(programmeCategory(prog({ ...noDates, status: "archived" }), on("2026-08-15"))).toBe("completed");
    expect(programmeCategory(prog({ ...noDates, status: "locked" }), on("2026-08-15"))).toBe("completed");
    expect(programmeCategory(prog({ ...noDates, status: "draft" }), on("2026-08-15"))).toBe("completed");
    expect(
      programmeCategory(prog({ effectiveFrom: "not-a-date", effectiveTill: "junk", status: "active" }), on("2026-08-15")),
    ).toBe("active");
  });
});
