import { describe, it, expect, beforeEach } from "vitest";
import { emptyBuilder, type BuilderState } from "@/components/wizard/builderState";
import { DEFAULT_NSV } from "@/components/kpi-library/nsvTypes";
import { buildRulePayloads } from "@/lib/rulePayload";
import { ruleToProgramme } from "@/lib/ruleToProgramme";
import { ruleToBuilder } from "@/lib/ruleToBuilder";
import type { Channel } from "@/types/programme";

/**
 * The division is written into user_filters as `salesOrg`. Both readers used to
 * look only for `division` / `outletDivision`, so every programme read back as
 * the "CCD" default — an HCD programme silently became CCD in the list and, worse,
 * in the wizard when edited. These tests pin writer and readers to one field name.
 */
function stateWith(division: Channel): BuilderState {
  return {
    ...emptyBuilder,
    basics: { ...emptyBuilder.basics, name: `${division} programme`, month: 8, year: 2026, period: "monthly" },
    audience: {
      ...emptyBuilder.audience,
      division,
      roles: ["Urban MR"],
      geographies: ["All India"],
      geographyExceptions: [],
    },
    channels: [],
    programKpis: [{ templateId: "nsv", instanceId: "k1", config: DEFAULT_NSV }],
    gates: [],
  };
}

describe("division round-trip", () => {
  beforeEach(() => localStorage.setItem("accountId", "default"));

  it.each<Channel>(["CCD", "HCD"])("writes %s as salesOrg and reads it back", (division) => {
    const rule = buildRulePayloads(stateWith(division))[0];

    // Writer: division goes into user_filters under `salesOrg`. A single value
    // is emitted as a scalar with op EQUALS (not a one-element array).
    expect(rule.applicabilityCriteria.user_filters?.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "salesOrg", op: "EQUALS", value: division }),
      ]),
    );

    // The POST body and the GET record share this shape; the record type just
    // also carries server-assigned fields, hence the cast.
    const asRecord = rule as unknown as Parameters<typeof ruleToProgramme>[0];
    // Reader 1 — the programmes list.
    expect(ruleToProgramme(asRecord).channel).toBe(division);
    // Reader 2 — edit / clone back into the wizard.
    expect(ruleToBuilder(asRecord).audience.division).toBe(division);
  });

  it("reads HCD from a live engine payload (scalar value, designation first)", () => {
    // Shape as the engine returns it: value is a bare string, not an array.
    const live = {
      ruleId: "7b13e019-b5bf-4127-a0ce-84eeadfb8fd0",
      ruleName: "roooo",
      status: "APPROVED",
      isActive: true,
      effectiveFrom: "2026-08-01",
      effectiveTill: "2026-08-31",
      applicabilityCriteria: {
        user_filters: {
          operator: "AND",
          rules: [
            { op: "EQUALS", field: "designation", value: "mr" },
            { op: "EQUALS", field: "salesOrg", value: "HCD" },
          ],
        },
        outlet_filters: {
          operator: "AND",
          rules: [{ op: "EQUALS", field: "marketType", value: "RURAL" }],
        },
      },
      ruleDefinition: { kpiId: "nsv", tiers: [] },
    } as unknown as Parameters<typeof ruleToProgramme>[0];

    expect(ruleToProgramme(live).channel).toBe("HCD");
    expect(ruleToBuilder(live).audience.division).toBe("HCD");
  });

  it("still honours the legacy division / outletDivision field names", () => {
    const legacy = (field: string) =>
      ({
        ruleName: "legacy",
        applicabilityCriteria: { user_filters: { operator: "AND", rules: [{ op: "EQUALS", field, value: "HCD" }] } },
        ruleDefinition: { kpiId: "nsv", tiers: [] },
      }) as unknown as Parameters<typeof ruleToProgramme>[0];

    expect(ruleToProgramme(legacy("division")).channel).toBe("HCD");
    expect(ruleToProgramme(legacy("outletDivision")).channel).toBe("HCD");
  });
});
