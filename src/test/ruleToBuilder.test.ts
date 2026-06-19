import { describe, it, expect } from "vitest";
import { ruleToBuilder } from "@/lib/ruleToBuilder";
import type { RuleRecord } from "@/lib/ruleApi";

describe("ruleToBuilder", () => {
  it("rebuilds basics, audience, channels and a KPI from a conditions-style rule", () => {
    const rule: RuleRecord = {
      id: "r1",
      ruleName: "June Sales Target Incentive",
      ruleCode: "RULE-2026-06-01",
      calculationFrequency: "MONTHLY",
      kpiCombination: "SALES_TARGET",
      effectiveFrom: "2026-06-01",
      effectiveTill: "2026-06-30",
      status: "DRAFT",
      applicabilityCriteria: {
        operator: "AND",
        conditions: [
          { property: "division", operator: "IN", values: ["CCD"] },
          { property: "channel", operator: "IN", values: ["GT", "MT"] },
          { property: "zone", operator: "IN", values: ["North"] },
          { property: "state", operator: "NOT_IN", values: ["Punjab"] },
        ],
      },
      kpiConfig: { userFilters: { roles: ["MR", "ASO"] } },
    };

    const b = ruleToBuilder(rule);
    expect(b.basics.name).toBe("June Sales Target Incentive");
    expect(b.basics.month).toBe(6);
    expect(b.basics.year).toBe(2026);
    expect(b.basics.period).toBe("monthly");
    expect(b.audience.division).toBe("CCD");
    expect(b.audience.roles).toEqual(["MR", "ASO"]);
    expect(b.audience.geographies).toEqual(["Zone: North"]);
    expect(b.audience.geographyExceptions).toEqual(["State: Punjab"]);
    expect(b.channels).toEqual(["GT", "MT"]);
    expect(b.programKpis).toHaveLength(1);
    expect(b.programKpis[0].templateId).toBe("nsv");
  });

  it("recovers the exact KPI from ruleDefinition.kpiCode (not the lossy kpiCombination)", () => {
    // phasing and nsv both map to SALES_TARGET; kpiCode disambiguates them.
    const rule: RuleRecord = {
      ruleName: "Phasing Program",
      calculationFrequency: "MONTHLY",
      kpiCombination: "SALES_TARGET",
      effectiveFrom: "2026-06-01",
      ruleDefinition: { kpiCode: "SALES_PHASING", payoutType: "CASH", tiers: [] },
    };
    expect(ruleToBuilder(rule).programKpis[0].templateId).toBe("phasing");
  });

  it("recovers the role from applicabilityCriteria when the engine dropped kpiConfig", () => {
    // The engine doesn't reliably preserve the verbatim kpiConfig (it returns a
    // null kpiConfig for some rules), so the role must be recoverable from the
    // applicabilityCriteria the engine always keeps. An explicit `role` filter
    // is read directly.
    const rule: RuleRecord = {
      ruleName: "June Incentive",
      calculationFrequency: "MONTHLY",
      kpiCombination: "UNIQUE_LINE_COUNT",
      effectiveFrom: "2026-06-01",
      kpiConfig: null as unknown as RuleRecord["kpiConfig"],
      applicabilityCriteria: {
        user_filters: { operator: "AND", rules: [{ field: "role", op: "EQUALS", value: "MR" }] },
        outlet_filters: { operator: "AND", rules: [{ field: "marketType", op: "EQUALS", value: "RURAL" }] },
      },
    };
    const b = ruleToBuilder(rule);
    expect(b.audience.roles).toEqual(["MR"]);
    // Role-related fields (marketType) must NOT leak into the Region picker.
    expect(b.audience.geographies).toEqual([]);
    expect(b.audience.geographyExceptions).toEqual([]);
  });

  it("falls back to the raw designation so the role section is never empty", () => {
    // When the role lives only in the (lossy, many-to-one) `designation` filter
    // and the role-config mappings haven't loaded, surface the raw value rather
    // than leaving the audience role blank.
    const rule: RuleRecord = {
      ruleName: "Designation only",
      calculationFrequency: "MONTHLY",
      kpiCombination: "TARGET_VS_ACHIEVEMENT",
      effectiveFrom: "2026-06-01",
      applicabilityCriteria: {
        user_filters: {
          operator: "AND",
          rules: [
            { field: "designation", op: "EQUALS", value: "mr" },
            { field: "geography", op: "EQUALS", value: "All India" },
          ],
        },
        outlet_filters: { operator: "AND", rules: [{ field: "marketType", op: "EQUALS", value: "URBAN" }] },
      },
    };
    const b = ruleToBuilder(rule);
    expect(b.audience.roles).toEqual(["mr"]);
    // Only the real geography ("All India") becomes a region tag — not the
    // designation or marketType.
    expect(b.audience.geographies).toEqual(["All India"]);
  });

  it("restores keyRules → keyNotes and step-up stepMode when the engine dropped templateConfig", () => {
    // No kpiConfig.templateConfig, so the config is rebuilt from ruleDefinition.
    // keyRules and stepUpBy1Percent must round-trip, not fall back to defaults.
    const rule: RuleRecord = {
      ruleName: "NSV Step-up",
      calculationFrequency: "MONTHLY",
      kpiCombination: "TARGET_VS_ACHIEVEMENT",
      effectiveFrom: "2026-06-01",
      ruleDefinition: {
        kpiCode: "NSV",
        stepUpBy1Percent: true,
        startingEarning: 2400,
        keyRules: ["Custom note A", "Custom note B"],
        tiers: [
          { min: 95, payoutValue: 0 },
          { min: 100, payoutValue: 320 },
          { min: 105, payoutValue: 200 },
          { min: 110, payoutValue: 200 },
        ],
      },
    };
    const cfg = ruleToBuilder(rule).programKpis[0].config as {
      keyNotes: string[];
      stepMode: string;
      slabs: Array<{ pct: number; ratePerPct: number; entryPayout?: number }>;
    };
    expect(cfg.keyNotes).toEqual(["Custom note A", "Custom note B"]);
    expect(cfg.stepMode).toBe("stepup");
    expect(cfg.slabs.map((s) => s.pct)).toEqual([95, 100, 105, 110]);
    expect(cfg.slabs[0].entryPayout).toBe(2400);
    expect(cfg.slabs.map((s) => s.ratePerPct)).toEqual([320, 320, 200, 200]);
  });

  it("restores stepMode 'slab' with per-slab entryPayout for a pure-slab (FIXED) rule", () => {
    const rule: RuleRecord = {
      ruleName: "NSV Pure Slab",
      calculationFrequency: "MONTHLY",
      kpiCombination: "TARGET_VS_ACHIEVEMENT",
      effectiveFrom: "2026-06-01",
      ruleDefinition: {
        kpiCode: "NSV",
        stepUpBy1Percent: false,
        keyRules: ["Slab note"],
        tiers: [
          { min: 95, payoutType: "FIXED", payoutValue: 2400 },
          { min: 100, payoutType: "FIXED", payoutValue: 4000 },
          { min: 105, payoutType: "FIXED", payoutValue: 5000 },
          { min: 110, payoutType: "FIXED", payoutValue: 6000 },
        ],
      },
    };
    const cfg = ruleToBuilder(rule).programKpis[0].config as {
      keyNotes: string[];
      stepMode: string;
      slabs: Array<{ pct: number; entryPayout?: number }>;
    };
    expect(cfg.keyNotes).toEqual(["Slab note"]);
    expect(cfg.stepMode).toBe("slab");
    // In slab mode every slab carries its absolute payout in entryPayout.
    expect(cfg.slabs.map((s) => s.entryPayout)).toEqual([2400, 4000, 5000, 6000]);
  });

  it("restores the phasing cutoffDay from ruleDefinition.cutOfDate (DD-MM-YYYY)", () => {
    const rule: RuleRecord = {
      ruleName: "Sales Phasing",
      calculationFrequency: "MONTHLY",
      kpiCombination: "SALES_TARGET",
      effectiveFrom: "2026-06-01",
      ruleDefinition: {
        kpiCode: "SALES_PHASING",
        stepUpBy1Percent: true,
        cutOfDate: "18-06-2026",
        keyRules: [],
        tiers: [
          { min: 55, payoutValue: 0 },
          { min: 75, payoutValue: 38 },
        ],
      },
    };
    const cfg = ruleToBuilder(rule).programKpis[0].config as { cutoffDay: number };
    expect(ruleToBuilder(rule).programKpis[0].templateId).toBe("phasing");
    expect(cfg.cutoffDay).toBe(18);
  });

  it("keeps the template default key notes when ruleDefinition.keyRules is empty", () => {
    const rule: RuleRecord = {
      ruleName: "NSV Default Notes",
      calculationFrequency: "MONTHLY",
      kpiCombination: "TARGET_VS_ACHIEVEMENT",
      effectiveFrom: "2026-06-01",
      ruleDefinition: {
        kpiCode: "NSV",
        stepUpBy1Percent: true,
        keyRules: [],
        tiers: [{ min: 95, payoutValue: 0 }],
      },
    };
    const cfg = ruleToBuilder(rule).programKpis[0].config as { keyNotes: string[] };
    // Falls back to the catalog defaults rather than an empty list.
    expect(cfg.keyNotes.length).toBeGreaterThan(0);
  });

  it("supports the legacy { zones, channels } criteria shape and maps the KPI type", () => {
    const rule: RuleRecord = {
      ruleName: "Coverage Push",
      calculationFrequency: "QUARTERLY",
      kpiCombination: "COVERAGE",
      effectiveFrom: "2026-04-01",
      applicabilityCriteria: { zones: ["South"], channels: ["GT"] },
    };
    const b = ruleToBuilder(rule);
    expect(b.basics.period).toBe("quarterly");
    expect(b.audience.geographies).toEqual(["Zone: South"]);
    expect(b.channels).toEqual(["GT"]);
    expect(b.audience.division).toBeUndefined();
    expect(b.programKpis[0].templateId).toBe("eco");
  });
});
