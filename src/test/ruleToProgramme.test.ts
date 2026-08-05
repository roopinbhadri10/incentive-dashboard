import { describe, it, expect } from "vitest";
import {
  ruleToProgramme, rulesToProgrammes, getSourceRule, getSourceRules,
} from "@/lib/ruleToProgramme";
import type { RuleRecord } from "@/lib/ruleApi";

const baseRule: RuleRecord = {
  id: "879e6123-b92f-4773-9d90-e344fb881ca9",
  ruleName: "June Sales Target Incentive",
  ruleCode: "RULE-2026-06-01",
  status: "DRAFT",
  isActive: true,
  effectiveFrom: "2026-06-01",
  effectiveTill: "2026-06-30",
  kpiConditions: { minAchievementPct: 60 },
  ruleDefinition: {
    payoutType: "CASH",
    tiers: [
      { minVal: 0, maxVal: 80, payout: 0 },
      { minVal: 80, maxVal: 100, payout: 1500 },
      { minVal: 100, maxVal: 9999, payout: 3000 },
    ],
  },
  applicabilityCriteria: { zones: ["NORTH"], channels: ["GT"] },
  creationTime: "2026-06-06T18:01:10.638",
  lastUpdateTime: "2026-06-06T18:01:10.638",
};

describe("ruleToProgramme", () => {
  it("maps a rules-engine record onto the Programme list shape", () => {
    const p = ruleToProgramme(baseRule);
    expect(p.id).toBe("879e6123-b92f-4773-9d90-e344fb881ca9");
    expect(p.name).toBe("June Sales Target Incentive");
    expect(p.status).toBe("draft");
    expect(p.period).toEqual({ month: 6, year: 2026, isQ1: false });
    expect(p.maxMonthlyEarning).toBe(3000); // top tier payout
    expect(p.gates.nsvMinPct).toBe(60);
    expect(p.channel).toBe("CCD"); // no division in criteria → default
    expect(p.createdAt).toBe("2026-06-06T18:01:10.638");
  });

  it('reads a published rule (status "APPROVED") as active, not draft', () => {
    // Publishing POSTs status: "APPROVED"; the list must show it as live rather
    // than falling through to the "draft" default.
    expect(ruleToProgramme({ ...baseRule, status: "APPROVED" }).status).toBe("active");
    // isActive: false still wins — an archived rule reads as archived.
    expect(
      ruleToProgramme({ ...baseRule, status: "APPROVED", isActive: false }).status,
    ).toBe("inactive");
    // An unrecognised status still defaults to draft.
    expect(ruleToProgramme({ ...baseRule, status: "WOBBLE" }).status).toBe("draft");
  });

  it("extracts the CCD/HCD division from the conditions-style criteria", () => {
    const p = ruleToProgramme({
      ...baseRule,
      applicabilityCriteria: {
        operator: "AND",
        conditions: [
          { property: "division", operator: "IN", values: ["HCD"] },
          { property: "channel", operator: "IN", values: ["GT", "MT"] },
        ],
      },
    });
    expect(p.channel).toBe("HCD");
  });

  it("falls back to ruleCode for the name and id when ruleName/id are absent", () => {
    const p = ruleToProgramme({ ruleCode: "RULE-X", status: "ACTIVE" });
    expect(p.name).toBe("RULE-X");
    expect(p.id).toBe("RULE-X");
    expect(p.status).toBe("active");
  });

  it("resolves the source rule by id, surviving object substitution", () => {
    // React Query's structuralSharing hands edit/clone a COPY of the Programme,
    // not the instance ruleToProgramme produced. getSourceRule must still find
    // the rule via the stable id — otherwise edit drops to the lossy path.
    const original = ruleToProgramme(baseRule);
    const structurallySharedCopy = { ...original };
    expect(structurallySharedCopy).not.toBe(original);
    expect(getSourceRule(structurallySharedCopy)).toBe(baseRule);
  });
});

describe("rulesToProgrammes — one row per programme", () => {
  /** The engine's record for KPI `n` of a programme: one rule each. */
  const kpiRule = (programId: string, n: number, max: number): RuleRecord => ({
    ...baseRule,
    id: `${programId}-rule-${n}`,
    programId,
    ruleCode: `RULE-2026-06-01-${n}`,
    ruleDefinition: {
      kpiId: `kpi_${n}`,
      kpiName: `KPI ${n}`,
      tiers: [
        { minVal: 0, maxVal: 80, payout: 0 },
        { minVal: 80, maxVal: 9999, payout: max },
      ],
    },
  });

  it("collapses a programme's 5 KPI rules into a single aggregated row", () => {
    const rules = [1, 2, 3, 4, 5].map((n) => kpiRule("prog-1", n, n * 1000));
    const programmes = rulesToProgrammes(rules);

    expect(programmes).toHaveLength(1);
    const [p] = programmes;
    expect(p.name).toBe("June Sales Target Incentive");
    // Max payout is the SUM across KPIs, not any single rule's top tier.
    expect(p.maxMonthlyEarning).toBe(1000 + 2000 + 3000 + 4000 + 5000);
    // Every KPI is summarised, in rule order, with its own max.
    expect(p.kpiSummaries?.map((k) => k.name)).toEqual([
      "KPI 1", "KPI 2", "KPI 3", "KPI 4", "KPI 5",
    ]);
    expect(p.kpiSummaries?.[2]).toMatchObject({ templateId: "kpi_3", maxEarning: 3000 });
    // Archiving / republishing has to reach every rule behind the row.
    expect(p.ruleIds).toEqual(rules.map((r) => r.id));
    // …and edit / clone must rebuild from all of them, not just the lead rule.
    expect(getSourceRules(p)).toEqual(rules);
    expect(getSourceRule(p)).toBe(rules[0]);
  });

  it("keeps separate programmes apart and preserves first-seen order", () => {
    const programmes = rulesToProgrammes([
      kpiRule("prog-a", 1, 1000),
      kpiRule("prog-b", 1, 500),
      kpiRule("prog-a", 2, 2000),
    ]);
    expect(programmes.map((p) => p.programId)).toEqual(["prog-a", "prog-b"]);
    expect(programmes[0].kpiSummaries).toHaveLength(2);
    expect(programmes[0].maxMonthlyEarning).toBe(3000);
    expect(programmes[1].kpiSummaries).toHaveLength(1);
  });

  it("groups pre-programId rules by name + effective window", () => {
    // Rules saved before programId existed still share the programme name and
    // window, so they must not each become their own row.
    const legacy = (n: number): RuleRecord => ({
      ...baseRule,
      id: `legacy-${n}`,
      programId: undefined,
      ruleDefinition: { kpiName: `KPI ${n}`, tiers: [{ minVal: 80, maxVal: 9999, payout: 700 }] },
    });
    const programmes = rulesToProgrammes([legacy(1), legacy(2)]);
    expect(programmes).toHaveLength(1);
    expect(programmes[0].maxMonthlyEarning).toBe(1400);

    // A different window is a different programme, even under the same name.
    const other = { ...legacy(3), effectiveFrom: "2026-07-01", effectiveTill: "2026-07-31" };
    expect(rulesToProgrammes([legacy(1), other])).toHaveLength(2);
  });
});
