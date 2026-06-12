// Reconstruct a wizard BuilderState from a rules-engine record (GET /v1/rules),
// used when cloning or editing a program. The forward mapping (builder → rule)
// is lossy — the rule stores payout tiers, not the original KPI template config —
// so the KPI is rebuilt with the matching template's default config, while
// basics + audience are restored from the rule's actual data.

import {
  emptyBuilder,
  uid,
  type BuilderState,
  type Channel,
  type ProgrammePeriod,
} from "@/components/wizard/builderState";
import { KPI_TEMPLATE_MAP, type KpiTemplateId } from "@/components/kpi-library/registry";
import type { RuleRecord } from "./ruleApi";

interface RuleCondition {
  property?: string;
  operator?: string;
  values?: string[];
}
interface ApplicabilityCriteria {
  conditions?: RuleCondition[];
  zones?: string[];
  channels?: string[];
  divisions?: string[];
}

const PERIOD_BY_FREQ: Record<string, ProgrammePeriod> = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  HALF_YEARLY: "half-yearly",
  ANNUAL: "annual",
  CUSTOM: "custom",
};

// Reverse of the best-effort KPI-type mapping used when building the payload.
const TEMPLATE_BY_KPI_TYPE: Record<string, KpiTemplateId> = {
  SALES_TARGET: "nsv",
  COVERAGE: "eco",
  DISTRIBUTION: "tlsd",
  COLLECTION: "collection",
  PRODUCTIVITY: "pcc",
  MUST_SELL_SKU: "must_sell_sku",
  AI_RECOMMENDED_ORDER: "ai_recommended_order",
};

const TAG_PREFIX: Record<string, string> = { zone: "Zone: ", state: "State: ", city: "City: " };

/** Geography tags (IN conditions → regions, NOT_IN → exceptions), both criteria shapes. */
function geoTagsFor(criteria: ApplicabilityCriteria, exceptions: boolean): string[] {
  const out: string[] = [];
  if (Array.isArray(criteria.conditions)) {
    for (const c of criteria.conditions) {
      if ((c.operator === "NOT_IN") !== exceptions) continue;
      if (c.property === "channel" || c.property === "division") continue;
      const prefix = TAG_PREFIX[c.property ?? ""] ?? "";
      for (const v of c.values ?? []) out.push(prefix ? `${prefix}${v}` : v);
    }
  } else if (!exceptions) {
    for (const v of criteria.zones ?? []) out.push(`Zone: ${v}`);
  }
  return out;
}

function channelsFor(criteria: ApplicabilityCriteria): string[] {
  if (Array.isArray(criteria.conditions)) {
    return criteria.conditions.find((c) => c.property === "channel" && c.operator !== "NOT_IN")?.values ?? [];
  }
  return criteria.channels ?? [];
}

function divisionFor(criteria: ApplicabilityCriteria): Channel | undefined {
  const v = Array.isArray(criteria.conditions)
    ? criteria.conditions.find((c) => c.property === "division")?.values?.[0]
    : criteria.divisions?.[0];
  return v === "CCD" || v === "HCD" ? v : undefined;
}

export function ruleToBuilder(rule: RuleRecord): BuilderState {
  const m = /^(\d{4})-(\d{2})/.exec(rule.effectiveFrom ?? "");
  const year = m ? Number(m[1]) : emptyBuilder.basics.year;
  const month = m ? Number(m[2]) : emptyBuilder.basics.month;
  const period = PERIOD_BY_FREQ[rule.calculationFrequency ?? ""] ?? "monthly";

  const criteria = (rule.applicabilityCriteria ?? {}) as ApplicabilityCriteria;
  const roles =
    (rule.kpiConfig as { userFilters?: { roles?: string[] } } | undefined)?.userFilters?.roles ?? [];
  const channels = channelsFor(criteria);

  const templateId = TEMPLATE_BY_KPI_TYPE[rule.kpiCombination ?? ""] ?? "nsv";
  const tpl = KPI_TEMPLATE_MAP[templateId];

  return {
    ...emptyBuilder,
    basics: {
      ...emptyBuilder.basics,
      name: rule.ruleName || rule.ruleCode || "Untitled programme",
      month,
      year,
      period,
    },
    audience: {
      ...emptyBuilder.audience,
      division: divisionFor(criteria),
      roles,
      geographies: geoTagsFor(criteria, false),
      geographyExceptions: geoTagsFor(criteria, true),
    },
    channels: channels.length ? channels : emptyBuilder.channels,
    programKpis: [{ templateId, instanceId: uid("kpi"), config: tpl.defaultConfig() }],
  };
}
