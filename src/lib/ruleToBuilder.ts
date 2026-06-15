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
import { getKpiCatalog } from "@/components/kpi-library/schema/kpiCatalog";
import type { RuleRecord } from "./ruleApi";

interface RuleCondition {
  property?: string;
  operator?: string;
  values?: string[];
}
interface FilterRule {
  field?: string;
  op?: string;
  value?: string | string[];
}
interface FilterGroup {
  operator?: string;
  rules?: FilterRule[];
}
interface ApplicabilityCriteria {
  // Current grouped shape (user_filters / outlet_filters).
  user_filters?: FilterGroup;
  outlet_filters?: FilterGroup;
  // Legacy flat conditions shape.
  conditions?: RuleCondition[];
  // Oldest shape.
  zones?: string[];
  channels?: string[];
  divisions?: string[];
}

/** Flatten any supported applicabilityCriteria shape into a list of conditions. */
function normalizeConditions(criteria: ApplicabilityCriteria): RuleCondition[] {
  // Grouped shape — merge both filter groups into a flat condition list.
  if (criteria.user_filters || criteria.outlet_filters) {
    const out: RuleCondition[] = [];
    for (const group of [criteria.user_filters, criteria.outlet_filters]) {
      for (const r of group?.rules ?? []) {
        const values = Array.isArray(r.value) ? r.value : r.value != null ? [r.value] : [];
        out.push({ property: r.field, operator: r.op === "NOT_IN" ? "NOT_IN" : "IN", values });
      }
    }
    return out;
  }
  // Legacy flat conditions.
  if (Array.isArray(criteria.conditions)) return criteria.conditions;
  // Oldest zones/channels/divisions arrays.
  const out: RuleCondition[] = [];
  for (const z of criteria.zones ?? []) out.push({ property: "zone", operator: "IN", values: [z] });
  for (const c of criteria.channels ?? []) out.push({ property: "channel", operator: "IN", values: [c] });
  for (const d of criteria.divisions ?? []) out.push({ property: "division", operator: "IN", values: [d] });
  return out;
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

/** Geography tags (IN conditions → regions, NOT_IN → exceptions). */
function geoTagsFor(conditions: RuleCondition[], exceptions: boolean): string[] {
  const out: string[] = [];
  for (const c of conditions) {
    if ((c.operator === "NOT_IN") !== exceptions) continue;
    if (c.property === "channel" || c.property === "division" || c.property === "role") continue;
    if (c.property === "outlet_type") continue;
    const prefix = TAG_PREFIX[c.property ?? ""] ?? "";
    for (const v of c.values ?? []) out.push(prefix ? `${prefix}${v}` : v);
  }
  return out;
}

function channelsFor(conditions: RuleCondition[]): string[] {
  return conditions.find((c) => c.property === "channel" && c.operator !== "NOT_IN")?.values ?? [];
}

function divisionFor(conditions: RuleCondition[]): Channel | undefined {
  const v = conditions.find((c) => c.property === "division")?.values?.[0];
  return v === "CCD" || v === "HCD" ? v : undefined;
}

function rolesFor(conditions: RuleCondition[]): string[] {
  return conditions.find((c) => c.property === "role")?.values ?? [];
}

/**
 * Recover the exact KPI template. `kpiCode` is 1:1 with a template, so prefer it
 * (matched against the catalog's meta.kpiCode). Falls back to the lossy
 * kpiCombination → template map for older rules saved without a kpiCode
 * (kpiCombination is many-to-one, so e.g. nsv/phasing/qnsv all collapse to nsv).
 */
function resolveTemplateId(rule: RuleRecord): KpiTemplateId {
  const kpiCode = rule.ruleDefinition?.kpiCode;
  if (kpiCode) {
    const match = Object.values(getKpiCatalog().entries).find(
      (e) => e.meta.kpiCode === kpiCode
    );
    if (match) return match.meta.id as KpiTemplateId;
  }
  return TEMPLATE_BY_KPI_TYPE[rule.kpiCombination ?? ""] ?? "nsv";
}

export function ruleToBuilder(rule: RuleRecord): BuilderState {
  const m = /^(\d{4})-(\d{2})/.exec(rule.effectiveFrom ?? "");
  const year = m ? Number(m[1]) : emptyBuilder.basics.year;
  const month = m ? Number(m[2]) : emptyBuilder.basics.month;
  const period = PERIOD_BY_FREQ[rule.calculationFrequency ?? ""] ?? "monthly";

  const criteria = (rule.applicabilityCriteria ?? {}) as ApplicabilityCriteria;
  const conditions = normalizeConditions(criteria);
  const roles =
    rolesFor(conditions).length > 0
      ? rolesFor(conditions)
      : (rule.kpiConfig as { userFilters?: { roles?: string[] } } | undefined)?.userFilters?.roles ?? [];
  const channels = channelsFor(conditions);

  const templateId = resolveTemplateId(rule);
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
      division: divisionFor(conditions),
      roles,
      geographies: geoTagsFor(conditions, false),
      geographyExceptions: geoTagsFor(conditions, true),
    },
    channels: channels.length ? channels : emptyBuilder.channels,
    programKpis: [{ templateId, instanceId: uid("kpi"), config: tpl.defaultConfig() }],
  };
}
