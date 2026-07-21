import { describe, it, expect } from "vitest";
import { emptyBuilder, type BuilderState } from "@/components/wizard/builderState";
import { DEFAULT_NSV, DEFAULT_NSV_KEY_NOTES } from "@/components/kpi-library/nsvTypes";
import { buildRulePayloads } from "@/lib/rulePayload";
import { buildCatalog } from "@/components/kpi-library/schema/kpiCatalog";
import { DUMMY_KPI_METAS } from "@/components/kpi-library/schema/dummyKpiConfig";

const ecoBaseConfig = () =>
  buildCatalog(DUMMY_KPI_METAS).entries.eco.defaultConfig() as Record<string, unknown>;

const ECO_SLABS = [
  { count: 150, ratePerOutlet: 2 },
  { count: 200, ratePerOutlet: 3 },
  { count: 250, ratePerOutlet: 4 },
];

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
    // config loaded in tests, it falls back to the raw role name), the division
    // (as salesOrg) and geography.
    expect(rule.applicabilityCriteria.user_filters).toEqual({
      operator: "AND",
      rules: [
        { field: "designation", op: "EQUALS", value: "MR" },
        { field: "salesOrg", op: "EQUALS", value: "CCD" },
        { field: "zone", op: "EQUALS", value: "North" },
      ],
    });
    // outlet_filters — where: trade channels (marketType is omitted when no
    // role-payload-value config is loaded).
    expect(rule.applicabilityCriteria.outlet_filters).toEqual({
      operator: "AND",
      rules: [
        { field: "channel", op: "IN", value: ["GT", "MT"] },
      ],
    });

    // The rule carries the tenant in its body too (not just the header).
    expect(rule.tenantId).toBe("default");
    // No gate configured → the gate-condition list is empty.
    expect(rule.gateConditions).toEqual([]);
    // DEFAULT_NSV is step-up: startingEarning at the entry slab, ₹/1% rate per tier.
    // ruleDefinition.kpiCode carries the engine KPI combination (matches the sample).
    expect(rule.ruleDefinition.kpiCode).toBe("TARGET_VS_ACHIEVEMENT");
    expect(rule.ruleDefinition.kpiId).toBe("nsv");
    expect(rule.ruleDefinition.kpiName).toBe("Net Sales Value");
    expect(rule.ruleDefinition.stepUpBy1Percent).toBe(true);
    expect(rule.ruleDefinition.startingEarning).toBe(2400);
    expect(rule.ruleDefinition.keyRules).toEqual(DEFAULT_NSV_KEY_NOTES);
    // Tiers project onto [min, max) ranges. Step-up: each band carries the rate
    // leading up to it (95→100 takes the 100%-row rate). DEFAULT_NSV caps at 110%,
    // so the tail is bounded to the cap (max: 110) and keeps the last rate (200),
    // then an explicit open tail at 0 marks "nothing earned past the cap".
    expect(rule.ruleDefinition.tiers).toEqual([
      { min: 95, max: 100, payoutType: "FIXED", payoutValue: 320 },
      { min: 100, max: 105, payoutType: "FIXED", payoutValue: 200 },
      { min: 105, max: 110, payoutType: "FIXED", payoutValue: 200 },
      { min: 110, max: 110, payoutType: "FIXED", payoutValue: 200 },
      { min: 110, max: null, payoutType: "FIXED", payoutValue: 0 },
    ]);

    // kpiConfig is the engine's snake_case KPI entity: named after the programme,
    // typed BASE, carrying the period cut-off and a copy of the applicability.
    expect(rule.kpiConfig.name).toBe("June Sales Target Incentive");
    expect(rule.kpiConfig.base_kpi_name).toBe("TARGET_VS_ACHIEVEMENT");
    expect(rule.kpiConfig.kpi_type).toBe("BASE");
    expect(rule.kpiConfig.is_enabled).toBe(true);
    expect(rule.kpiConfig.calculation_logic).toEqual({ cutoff_date: "2026-06-30T23:59:59Z" });
    expect(rule.kpiConfig.user_filters).toEqual(rule.applicabilityCriteria.user_filters);
    expect(rule.kpiConfig.outlet_filters).toEqual(rule.applicabilityCriteria.outlet_filters);
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
          cap: { enabled: true, pct: 110 },
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
    // Cap enabled, step-up off → the open tail keeps the last tier's own payout (4000).
    expect(rule.ruleDefinition.tiers).toEqual([
      { min: 95, max: 100, payoutType: "FIXED", payoutValue: 2400 },
      { min: 100, max: 105, payoutType: "FIXED", payoutValue: 3000 },
      { min: 105, max: null, payoutType: "FIXED", payoutValue: 4000 },
    ]);
  });

  it("leaves the step-up tail open (max:null) when the cap is disabled", () => {
    const state = sampleState();
    state.programKpis = [
      { templateId: "nsv", instanceId: "k1", config: { ...DEFAULT_NSV, cap: { enabled: false, pct: 110 } } },
    ];
    const rule = buildRulePayloads(state)[0];
    expect(rule.ruleDefinition.stepUpBy1Percent).toBe(true);
    // No cap → the open tail past the top slab is unbounded (max: null) and keeps
    // earning at the last band's rate (200).
    expect(rule.ruleDefinition.tiers).toEqual([
      { min: 95, max: 100, payoutType: "FIXED", payoutValue: 320 },
      { min: 100, max: 105, payoutType: "FIXED", payoutValue: 200 },
      { min: 105, max: 110, payoutType: "FIXED", payoutValue: 200 },
      { min: 110, max: null, payoutType: "FIXED", payoutValue: 200 },
    ]);
  });

  it("bounds the outlet-count tail to the cap (max payable outlets) when capping is on", () => {
    const state = sampleState();
    state.programKpis = [
      {
        templateId: "eco",
        instanceId: "k1",
        config: { ...ecoBaseConfig(), slabs: ECO_SLABS, cap: { enabled: true, outlets: 300 } },
      },
    ];
    const rule = buildRulePayloads(state)[0];
    // Per-outlet curves are linear → emitted as step-up.
    expect(rule.ruleDefinition.stepUpBy1Percent).toBe(true);
    // The minimum bill value threshold rides on ruleDefinition (eco default: ₹250).
    expect(rule.ruleDefinition.minBillAmount).toBe(250);
    // Each band carries its own ₹-per-outlet rate; the tail is bounded to 300, then
    // an explicit open tail at 0 marks "nothing earned past the cap".
    expect(rule.ruleDefinition.tiers).toEqual([
      { min: 150, max: 200, payoutType: "FIXED", payoutValue: 2 },
      { min: 200, max: 250, payoutType: "FIXED", payoutValue: 3 },
      { min: 250, max: 300, payoutType: "FIXED", payoutValue: 4 },
      { min: 300, max: null, payoutType: "FIXED", payoutValue: 0 },
    ]);
  });

  it("leaves the outlet-count tail open (max:null) when capping is off", () => {
    const state = sampleState();
    state.programKpis = [
      {
        templateId: "eco",
        instanceId: "k1",
        config: { ...ecoBaseConfig(), slabs: ECO_SLABS, cap: { enabled: false, outlets: 300 } },
      },
    ];
    const rule = buildRulePayloads(state)[0];
    expect(rule.ruleDefinition.tiers).toEqual([
      { min: 150, max: 200, payoutType: "FIXED", payoutValue: 2 },
      { min: 200, max: 250, payoutType: "FIXED", payoutValue: 3 },
      { min: 250, max: null, payoutType: "FIXED", payoutValue: 4 },
    ]);
  });

  it("passes the ₹-per-line rate (not the computed top payout) for line-based KPIs", () => {
    const tlsdBase = buildCatalog(DUMMY_KPI_METAS).entries.tlsd.defaultConfig() as Record<string, unknown>;
    const state = sampleState();
    state.programKpis = [
      {
        templateId: "tlsd",
        instanceId: "k1",
        config: {
          ...tlsdBase,
          minLines: 750,
          maxLines: 2500,
          ratePerLine: 4,
          minQtyEnabled: true,
          minQtyValue: 5,
        },
      },
    ];
    const rule = buildRulePayloads(state)[0];
    expect(rule.ruleDefinition.lineBasedEarning).toBe(true);
    // Per-line curves are linear → emitted as step-up.
    expect(rule.ruleDefinition.stepUpBy1Percent).toBe(true);
    // The min qty to qualify a line rides on ruleDefinition when enabled.
    expect(rule.ruleDefinition.minQtyValue).toBe(5);
    // First band earns the per-line rate (4), not maxLines × rate; tail past the cap earns 0.
    expect(rule.ruleDefinition.tiers).toEqual([
      { min: 750, max: 2500, payoutType: "FIXED", payoutValue: 4 },
      { min: 2500, max: null, payoutType: "FIXED", payoutValue: 0 },
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

  it("maps a wizard gate onto a gateCondition with the engine's comparator/consequence", () => {
    const state = sampleState();
    state.programKpis = [{ templateId: "nsv", instanceId: "k1", config: DEFAULT_NSV }];
    state.gates = [
      {
        id: "g1",
        joiner: "AND",
        consequence: { kind: "reduce", percent: 50, scope: "all" },
        conditions: [
          { metricGroup: "kpi", metric: "nsv", operator: "gt", value: 80, unit: "pct" },
        ],
      },
    ];
    const rule = buildRulePayloads(state)[0];
    expect(rule.gateConditions).toHaveLength(1);
    const gc = rule.gateConditions[0];
    // metricGroup "kpi" + metric "nsv" resolves to the catalog's base KPI name.
    expect(gc.gateKpiCode).toBe("TARGET_VS_ACHIEVEMENT");
    expect(gc.threshold).toBe(80);
    expect(gc.comparator).toBe("GT");
    expect(gc.evaluationBasis).toBe("PERCENTAGE");
    // reduce → LIMIT_PAYOUT_PCT { limitToPct } (scope "all" carries no extra field).
    expect(gc.consequenceType).toBe("LIMIT_PAYOUT_PCT");
    expect(gc.consequenceConfig).toEqual({ limitToPct: 50 });
    expect(gc.priority).toBe(0);
    expect(gc.isActive).toBe(true);
    // The gate KPI config uses the gate contract's camelCase keys, scoped to the audience.
    expect(gc.gateKpiConfig.baseKpiName).toBe("TARGET_VS_ACHIEVEMENT");
    expect(gc.gateKpiConfig.kpiType).toBe("TARGET_VS_ACHIEVEMENT");
    expect(gc.gateKpiConfig.enabled).toBe(true);
    expect(gc.gateKpiConfig.user_filters).toEqual(rule.applicabilityCriteria.user_filters);
  });

  it("appends a KPI's own gates to that KPI's rule only, after the program-level gates", () => {
    const state = sampleState();
    // Program-level gate — applies to every KPI's rule.
    state.gates = [
      {
        id: "g1",
        joiner: "AND",
        consequence: { kind: "zero-all" },
        conditions: [
          { metricGroup: "attendance", metric: "Absent days", operator: "gt", value: 5, unit: "days" },
        ],
      },
    ];
    // Two KPIs; only the second carries its own KPI-level gate.
    state.programKpis = [
      { templateId: "nsv", instanceId: "k1", config: DEFAULT_NSV },
      {
        templateId: "nsv",
        instanceId: "k2",
        config: {
          ...DEFAULT_NSV,
          gatesEnabled: true,
          gates: [
            {
              id: "kg1",
              dependsOnKpiId: "attendance::ABSENT_DAYS",
              thresholdValue: 80,
              thresholdUnit: "pct",
              consequence: { kind: "limit", pct: 50 },
            },
          ],
        },
      },
    ];
    const [ruleA, ruleB] = buildRulePayloads(state);

    // KPI A: just the program-level gate.
    expect(ruleA.gateConditions).toHaveLength(1);
    expect(ruleA.gateConditions[0].consequenceType).toBe("ZERO_PAYOUT");

    // KPI B: program-level gate first, then its own gate (priority continues).
    expect(ruleB.gateConditions).toHaveLength(2);
    expect(ruleB.gateConditions[0].consequenceType).toBe("ZERO_PAYOUT");
    expect(ruleB.gateConditions[0].priority).toBe(0);
    const own = ruleB.gateConditions[1];
    // The gate code (not the display label) becomes the engine gateKpiCode.
    expect(own.gateKpiCode).toBe("ABSENT_DAYS");
    expect(own.threshold).toBe(80);
    // KPI-level gate has no operator — passing means reaching the threshold (GTE).
    expect(own.comparator).toBe("GTE");
    expect(own.evaluationBasis).toBe("PERCENTAGE");
    // limit → LIMIT_PAYOUT_PCT { limitToPct }.
    expect(own.consequenceType).toBe("LIMIT_PAYOUT_PCT");
    expect(own.consequenceConfig).toEqual({ limitToPct: 50 });
    expect(own.priority).toBe(1);
    expect(own.gateKpiConfig.baseKpiName).toBe("ABSENT_DAYS");
    expect(own.gateKpiConfig.kpiType).toBe("ATTENDANCE");
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
