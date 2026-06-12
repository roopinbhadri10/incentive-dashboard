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
