import { describe, it, expect } from "vitest";
import { ruleToProgramme, getSourceRule } from "@/lib/ruleToProgramme";
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
