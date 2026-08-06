import { describe, it, expect } from "vitest";
import {
  emptyBuilder,
  isSingleMonthWindow,
  programmeStartLabel,
  programmeWindowLabel,
  type BasicsState,
} from "@/components/wizard/builderState";
import { buildRulePayloads } from "@/lib/rulePayload";
import { DEFAULT_NSV } from "@/components/kpi-library/nsvTypes";

const basics = (over: Partial<BasicsState>): BasicsState => ({
  ...emptyBuilder.basics,
  month: 9,
  year: 2026,
  ...over,
});

describe("programmeWindowLabel", () => {
  it("labels a monthly programme with its month, not the quarter it falls in", () => {
    // The reported bug: period=monthly + month=Sep rendered as
    // "Q2 FY27 (Jul + Aug + Sep)" — a 3-month window the programme never has.
    const b = basics({ period: "monthly" });
    expect(programmeWindowLabel(b)).toBe("Sep 2026");
    expect(isSingleMonthWindow(b)).toBe(true);
  });

  it("labels a quarter-scoped programme with its quarter and months", () => {
    // The quarter picker sets `month` to the quarter's first month.
    const b = basics({ period: "quarterly", month: 7 });
    expect(programmeWindowLabel(b)).toBe("Q3 2026 (Jul + Aug + Sep)");
    expect(isSingleMonthWindow(b)).toBe(false);
    expect(programmeWindowLabel(basics({ period: "monthly-plus-quarterly", month: 4 }))).toBe(
      "Q2 2026 (Apr + May + Jun)",
    );
  });

  it("numbers quarters from the programme's own calendar, not a fixed April", () => {
    const fiscal = { kind: "fiscal", startMonth: 4 } as const;
    expect(programmeWindowLabel(basics({ period: "quarterly", month: 7, calendar: fiscal }))).toBe(
      "Q2 2026 (Jul + Aug + Sep)",
    );
  });

  it("describes a 3-month window that misses the quarter grid by its months", () => {
    // Rounding Aug–Oct up to "Q2" would name a window the programme doesn't cover.
    expect(programmeWindowLabel(basics({ period: "quarterly", month: 8 }))).toBe(
      "Aug 2026 → Oct 2026",
    );
  });

  it("rolls the year over for windows that cross December", () => {
    expect(programmeWindowLabel(basics({ period: "half-yearly", month: 11 }))).toBe(
      "Nov 2026 → Apr 2027",
    );
    expect(programmeWindowLabel(basics({ period: "annual", month: 4 }))).toBe(
      "Apr 2026 → Mar 2027",
    );
  });

  it("uses the explicit dates of a custom window", () => {
    const b = basics({ period: "custom", customStart: "2026-07-15", customEnd: "2026-09-30" });
    expect(programmeWindowLabel(b)).toBe("2026-07-15 → 2026-09-30");
    expect(programmeStartLabel(b)).toBe("2026-07-15");
    expect(isSingleMonthWindow(b)).toBe(false);
  });

  it("names the window's opening month for prose", () => {
    expect(programmeStartLabel(basics({ period: "monthly" }))).toBe("Sep 2026");
    expect(programmeStartLabel(basics({ period: "quarterly", month: 7 }))).toBe("Jul 2026");
  });
});

describe("programmeWindowLabel agrees with the published effective window", () => {
  // The label exists to tell the user what will be published, so it has to track
  // the same span rulePayload sends — hence one shared MONTHS_BY_PERIOD.
  const publishedWindow = (b: BasicsState) => {
    const [rule] = buildRulePayloads({
      ...emptyBuilder,
      basics: { ...b, name: "P" },
      programKpis: [{ templateId: "nsv", instanceId: "k1", config: DEFAULT_NSV }],
    });
    return { from: rule.effectiveFrom, till: rule.effectiveTill };
  };

  it("spans one month for monthly", () => {
    expect(publishedWindow(basics({ period: "monthly" }))).toEqual({
      from: "2026-09-01",
      till: "2026-09-30",
    });
    expect(programmeWindowLabel(basics({ period: "monthly" }))).toBe("Sep 2026");
  });

  it("spans the three months the quarter label names", () => {
    const b = basics({ period: "quarterly", month: 7 });
    expect(publishedWindow(b)).toEqual({ from: "2026-07-01", till: "2026-09-30" });
    expect(programmeWindowLabel(b)).toBe("Q3 2026 (Jul + Aug + Sep)");
  });

  it("spans twelve months for annual, ending where the label says", () => {
    const b = basics({ period: "annual", month: 4 });
    expect(publishedWindow(b)).toEqual({ from: "2026-04-01", till: "2027-03-31" });
    expect(programmeWindowLabel(b)).toBe("Apr 2026 → Mar 2027");
  });
});
