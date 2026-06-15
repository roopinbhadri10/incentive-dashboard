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
    expect(rule.ruleType).toBe("SLAB");
    expect(rule.calculationFrequency).toBe("MONTHLY");
    expect(rule.kpiCombination).toBe("TARGET_VS_ACHIEVEMENT");
    expect(rule.effectiveFrom).toBe("2026-06-01");
    expect(rule.effectiveTill).toBe("2026-06-30");
    expect(rule.ruleCode).toBe("RULE-2026-06-01");
    expect(rule.status).toBe("DRAFT");

    // user_filters — who: the role (as its designation; with no role-designation
    // config loaded in tests, it falls back to the raw role name) and geography.
    expect(rule.applicabilityCriteria.user_filters).toEqual({
      operator: "AND",
      rules: [
        { field: "designation", op: "EQUALS", value: "MR" },
        { field: "zone", op: "EQUALS", value: "North" },
      ],
    });
    // outlet_filters — where: division then trade channels (marketType is omitted
    // when no role-payload-value config is loaded).
    expect(rule.applicabilityCriteria.outlet_filters).toEqual({
      operator: "AND",
      rules: [
        { field: "division", op: "EQUALS", value: "CCD" },
        { field: "channel", op: "IN", value: ["GT", "MT"] },
      ],
    });

    // Entry slab is the minimum achievement; tiers are cumulative payouts.
    expect(rule.kpiConditions.minAchievementPct).toBe(95);
    expect(rule.ruleDefinition.kpiCode).toBe("NSV");
    expect(rule.ruleDefinition.tiers).toEqual([
      { minVal: 0, maxVal: 95, payout: 0 },
      { minVal: 95, maxVal: 100, payout: 2400 },
      { minVal: 100, maxVal: 105, payout: 4000 },
      { minVal: 105, maxVal: 110, payout: 5000 },
      { minVal: 110, maxVal: 9999, payout: 6000 },
    ]);

    expect(rule.kpiConfig.userFilters.roles).toEqual(["MR", "ASO"]);
    expect(rule.kpiConfig.name).toBe("June Sales Target Incentive – TARGET_VS_ACHIEVEMENT");
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
