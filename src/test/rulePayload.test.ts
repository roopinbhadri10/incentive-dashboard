import { describe, it, expect } from "vitest";
import { emptyBuilder, type BuilderState } from "@/components/wizard/builderState";
import { DEFAULT_NSV, DEFAULT_NSV_KEY_NOTES } from "@/components/kpi-library/nsvTypes";
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
        { field: "outletDivision", op: "EQUALS", value: "CCD" },
        { field: "channel", op: "IN", value: ["GT", "MT"] },
      ],
    });

    // No % gate configured → the rule carries no kpiConditions hurdle.
    expect(rule.kpiConditions).toBeUndefined();
    // DEFAULT_NSV is step-up: startingEarning at the entry slab, ₹/1% rate per tier.
    expect(rule.ruleDefinition.kpiCode).toBe("NSV");
    expect(rule.ruleDefinition.stepUpBy1Percent).toBe(true);
    expect(rule.ruleDefinition.startingEarning).toBe(2400);
    expect(rule.ruleDefinition.keyRules).toEqual(DEFAULT_NSV_KEY_NOTES);
    expect(rule.ruleDefinition.tiers).toEqual([
      { min: 95, payoutValue: 0 },
      { min: 100, payoutValue: 320 },
      { min: 105, payoutValue: 200 },
      { min: 110, payoutValue: 200 },
    ]);

    expect(rule.kpiConfig.userFilters.roles).toEqual(["MR", "ASO"]);
    expect(rule.kpiConfig.name).toBe("June Sales Target Incentive – TARGET_VS_ACHIEVEMENT");
  });

  it("emits FIXED tiers (no step-up) for pure-slab payouts", () => {
    const state = sampleState();
    state.programKpis = [
      {
        templateId: "nsv",
        instanceId: "k1",
        config: {
          ...DEFAULT_NSV,
          stepMode: "slab",
          slabs: [
            { pct: 95, ratePerPct: 0, entryPayout: 2400 },
            { pct: 100, ratePerPct: 0, entryPayout: 3000 },
            { pct: 105, ratePerPct: 0, entryPayout: 4000 },
          ],
        },
      },
    ];
    const rule = buildRulePayloads(state)[0];
    expect(rule.ruleDefinition.stepUpBy1Percent).toBe(false);
    expect(rule.ruleDefinition.startingEarning).toBeUndefined();
    expect(rule.ruleDefinition.tiers).toEqual([
      { min: 95, payoutType: "FIXED", payoutValue: 2400 },
      { min: 100, payoutType: "FIXED", payoutValue: 3000 },
      { min: 105, payoutType: "FIXED", payoutValue: 4000 },
    ]);
  });

  it("resolves a KPI cut-off day onto ruleDefinition.cutOfDate", () => {
    const state = sampleState(); // June 2026
    state.programKpis = [
      { templateId: "nsv", instanceId: "k1", config: { ...DEFAULT_NSV, cutoffDay: 20 } },
    ];
    const rd = buildRulePayloads(state)[0].ruleDefinition;
    expect(rd.cutOfDate).toBe("20-06-2026"); // DD-MM-YYYY from the rule's month/year
  });

  it("omits cutOfDate when the KPI defines no cut-off day", () => {
    const rd = buildRulePayloads(sampleState())[0].ruleDefinition;
    expect(rd.cutOfDate).toBeUndefined();
  });

  it("maps a percentage gate onto kpiConditions.hurdle.required_percentage", () => {
    const state = sampleState();
    state.gates = [
      {
        id: "g1",
        joiner: "AND",
        consequence: { kind: "zero-all" },
        conditions: [
          { metricGroup: "kpi", metric: "nsv", operator: "gt", value: 50, unit: "pct" },
        ],
      },
    ];
    const rule = buildRulePayloads(state)[0];
    expect(rule.kpiConditions).toEqual({ hurdle: { required_percentage: 50 } });
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
