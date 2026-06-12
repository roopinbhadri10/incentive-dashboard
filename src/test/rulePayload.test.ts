import { describe, it, expect } from "vitest";
import { emptyBuilder, type BuilderState } from "@/components/wizard/builderState";
import { DEFAULT_NSV } from "@/components/kpi-library/nsvTypes";
import { buildRulePayloads } from "@/lib/rulePayload";

function sampleState(): BuilderState {
  return {
    ...emptyBuilder,
    basics: {
      ...emptyBuilder.basics,
      name: "June Sales Target Incentive",
      month: 6,
      year: 2026,
      period: "monthly",
    },
    audience: {
      ...emptyBuilder.audience,
      division: "CCD",
      roles: ["MR", "ASO"],
      geographies: ["Zone: North"],
      geographyExceptions: [],
    },
    channels: ["GT", "MT"],
    programKpis: [{ templateId: "nsv", instanceId: "k1", config: DEFAULT_NSV }],
    gates: [],
  };
}

describe("buildRulePayloads", () => {
  it("maps a single-KPI program onto one rule in the engine format", () => {
    const rules = buildRulePayloads(sampleState());
    expect(rules).toHaveLength(1);
    const rule = rules[0];

    expect(rule.ruleName).toBe("June Sales Target Incentive");
    expect(rule.ruleType).toBe("TIERED");
    expect(rule.calculationFrequency).toBe("MONTHLY");
    expect(rule.kpiCombination).toBe("SALES_TARGET");
    expect(rule.effectiveFrom).toBe("2026-06-01");
    expect(rule.effectiveTill).toBe("2026-06-30");
    expect(rule.ruleCode).toBe("RULE-2026-06-01");
    expect(rule.status).toBe("DRAFT");

    expect(rule.applicabilityCriteria.conditions).toEqual([
      { property: "division", operator: "IN", values: ["CCD"] },
      { property: "channel", operator: "IN", values: ["GT", "MT"] },
      { property: "zone", operator: "IN", values: ["North"] },
    ]);

    // Entry slab is the minimum achievement; tiers are cumulative payouts.
    expect(rule.kpiConditions.minAchievementPct).toBe(95);
    expect(rule.ruleDefinition.tiers).toEqual([
      { minVal: 0, maxVal: 95, payout: 0 },
      { minVal: 95, maxVal: 100, payout: 2400 },
      { minVal: 100, maxVal: 105, payout: 4000 },
      { minVal: 105, maxVal: 110, payout: 5000 },
      { minVal: 110, maxVal: 9999, payout: 6000 },
    ]);

    expect(rule.kpiConfig.userFilters.roles).toEqual(["MR", "ASO"]);
    expect(rule.kpiConfig.name).toBe("June Sales Target Incentive – SALES_TARGET");
  });

  it("emits one rule per KPI with unique rule codes for multi-KPI programs", () => {
    const state = sampleState();
    state.programKpis = [
      { templateId: "nsv", instanceId: "k1", config: DEFAULT_NSV },
      { templateId: "nsv", instanceId: "k2", config: DEFAULT_NSV },
    ];
    const rules = buildRulePayloads(state);
    expect(rules.map((r) => r.ruleCode)).toEqual(["RULE-2026-06-01-1", "RULE-2026-06-01-2"]);
  });
});
