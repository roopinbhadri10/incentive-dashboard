// Maps the incentive wizard's BuilderState (everything the user typed into the
// "Create New Program" form) onto the rules-engine POST payload accepted by
// `POST /v1/rules`. One API rule is emitted per KPI the user added — a
// single-KPI program produces exactly one rule object.

import type {
  AudienceV2State,
  BasicsState,
  BuilderState,
  GateRule,
  ProgrammePeriod,
} from "@/components/wizard/builderState";
import { KPI_TEMPLATE_MAP, type KpiTemplateId } from "@/components/kpi-library/registry";
import { getRolePayloadValue, getRoleDesignation } from "@/lib/saleshubApi";
import { computeSlabEarnings, type NsvSlab } from "@/components/kpi-library/nsvTypes";

/* ─── Payload shape (mirrors the documented /v1/rules contract) ──────────── */

/** A single filter rule. Scalar `value` for EQUALS, array for IN / NOT_IN. */
export interface FilterRule {
  field: string;
  op: "EQUALS" | "IN" | "NOT_IN";
  value: string | string[];
}

/** A group of filter rules combined by a boolean operator. */
export interface FilterGroup {
  operator: "AND" | "OR";
  rules: FilterRule[];
}

/**
 * Applicability split into two groups:
 *  - user_filters:   who (division, role, geography — zone/state/city).
 *  - outlet_filters: where (trade channel, and the role-specific outlet_type
 *    sourced from the role config).
 */
export interface ApplicabilityCriteria {
  user_filters: FilterGroup;
  outlet_filters: FilterGroup;
}

export interface RuleTier {
  minVal: number;
  maxVal: number;
  payout: number;
}

export interface ProductFilter {
  categories: string[];
  brands: string[];
  skuGroups: string[];
  skuIds: string[];
  coreSkusOnly: boolean;
  excludeVariants: string[];
}

export interface RuleApiPayload {
  lobId: string;
  ruleName: string;
  ruleCode: string;
  ruleType: string;
  calculationFrequency: string;
  kpiCombination: string;
  effectiveFrom: string;
  effectiveTill: string;
  priority: number;
  status: string;
  isActive: boolean;
  applicabilityCriteria: ApplicabilityCriteria;
  kpiConditions: { minAchievementPct: number };
  ruleDefinition: { kpiCode: string; payoutType: string; tiers: RuleTier[] };
  kpiConfig: {
    kpiType: string;
    name: string;
    baseKpiName: string;
    enabled: boolean;
    userFilters: { roles: string[]; properties: Record<string, string[]> };
    scopeConfig: { productFilter: ProductFilter };
    calculationConfig: { aggregationFunction: string; metricField: string };
    // UI round-trip fields — carry the full wizard KPI config verbatim so edit /
    // clone can restore the exact values the user entered, for every KPI type.
    // (ruleDefinition.tiers above is a lossy projection that can't be reversed
    // faithfully.) The engine ignores these; they survive the POST → GET trip.
    templateId: string;
    templateConfig: unknown;
    customName?: string;
    scope?: unknown;
    groupIds?: string[];
  };
}

/* ─── Config-derived values that have no direct form field default to these.
   Override the org/LOB via a VITE_LOB_ID env var. ───────────────────────── */

const LOB_ID = import.meta.env.VITE_LOB_ID ?? "85f09623-1d41-47cc-bf51-c0372df37df3";

const FREQ_BY_PERIOD: Record<ProgrammePeriod, string> = {
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  "monthly-plus-quarterly": "MONTHLY",
  "half-yearly": "HALF_YEARLY",
  annual: "ANNUAL",
  custom: "CUSTOM",
};

const MONTHS_BY_PERIOD: Record<ProgrammePeriod, number> = {
  monthly: 1,
  quarterly: 3,
  "monthly-plus-quarterly": 3,
  "half-yearly": 6,
  annual: 12,
  custom: 1,
};

// Best-effort mapping of an FMCG KPI template onto the engine's KPI type enum.
const KPI_TYPE_BY_TEMPLATE: Partial<Record<KpiTemplateId, string>> = {
  nsv: "TARGET_VS_ACHIEVEMENT",
  phasing: "SALES_TARGET",
  qnsv: "SALES_TARGET",
  eco: "COVERAGE",
  new_outlets: "COVERAGE",
  tlsd: "UNIQUE_LINE_COUNT",
  dbb: "DISTRIBUTION",
  ulpo: "DISTRIBUTION",
  range_selling: "DISTRIBUTION",
  collection: "COLLECTION",
  pcc: "PRODUCTIVITY",
  call_compliance: "PRODUCTIVITY",
  must_sell_sku: "MUST_SELL_SKU",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Programme period → ISO effectiveFrom / effectiveTill (inclusive of the last day). */
function periodRange(b: BasicsState): { from: string; till: string } {
  if (b.period === "custom" && b.customStart && b.customEnd) {
    return { from: b.customStart, till: b.customEnd };
  }
  const span = MONTHS_BY_PERIOD[b.period] ?? 1;
  const from = `${b.year}-${pad2(b.month)}-01`;
  const endIndex = b.month - 1 + (span - 1); // 0-based month offset from Jan of b.year
  const endYear = b.year + Math.floor(endIndex / 12);
  const endMonth = (endIndex % 12) + 1; // 1-based
  const lastDay = new Date(endYear, endMonth, 0).getDate(); // day 0 of next month = last day
  return { from, till: `${endYear}-${pad2(endMonth)}-${pad2(lastDay)}` };
}

/** "Zone: West" → { zone: ["West"] }; bare tags fall under "geography"; "All regions" is dropped. */
function parseGeoTags(tags: string[] | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const tag of tags ?? []) {
    if (!tag || /all regions/i.test(tag)) continue;
    const idx = tag.indexOf(":");
    const prop = idx >= 0 ? tag.slice(0, idx).trim().toLowerCase() : "geography";
    const val = idx >= 0 ? tag.slice(idx + 1).trim() : tag.trim();
    (out[prop] ||= []).push(val);
  }
  return out;
}

/** One value → EQUALS scalar; many → IN/NOT_IN array. */
function toFilterRule(field: string, values: string[], op: "IN" | "NOT_IN" = "IN"): FilterRule {
  if (op === "IN" && values.length === 1) return { field, op: "EQUALS", value: values[0] };
  return { field, op, value: values };
}

function buildApplicabilityCriteria(
  audience: AudienceV2State,
  channels: string[]
): ApplicabilityCriteria {
  // user_filters — who: role and geography (zone / state / city).
  const userRules: FilterRule[] = [];
  const role = audience.roles?.[0];
  if (role) {
    // Map the selected role onto its API designation (e.g. all *MR roles → "mr").
    const designation = getRoleDesignation(role) || role;
    userRules.push(toFilterRule("designation", [designation]));
  }
  for (const [field, values] of Object.entries(parseGeoTags(audience.geographies))) {
    userRules.push(toFilterRule(field, values, "IN"));
  }
  for (const [field, values] of Object.entries(parseGeoTags(audience.geographyExceptions))) {
    userRules.push(toFilterRule(field, values, "NOT_IN"));
  }

  // outlet_filters — where: division, trade channels, and the role-specific
  // marketType sourced from the role config (role_payload_value_configuration).
  const outletRules: FilterRule[] = [];
  if (audience.division) {
    outletRules.push(toFilterRule("division", [audience.division]));
  }
  if (channels?.length) {
    outletRules.push(toFilterRule("channel", channels, "IN"));
  }
  const marketType = role ? getRolePayloadValue(role) : "";
  if (marketType) {
    outletRules.push(toFilterRule("marketType", [marketType]));
  }

  return {
    user_filters: { operator: "AND", rules: userRules },
    outlet_filters: { operator: "AND", rules: outletRules },
  };
}

// Loose view over the heterogeneous KPI configs — only the slab-ish fields we read.
interface SlabLikeConfig {
  slabs?: Array<{
    pct?: number;
    ratePerPct?: number;
    entryPayout?: number;
    threshold?: number;
    payout?: number;
    count?: number;
    ratePerOutlet?: number;
  }>;
  stepMode?: "stepup" | "slab";
  minLines?: number;
  maxLines?: number;
  ratePerLine?: number;
}

/** Convert a KPI's slab structure into engine tiers [{minVal,maxVal,payout}]. */
function tiersFor(templateId: KpiTemplateId, config: unknown): RuleTier[] {
  const cfg = (config ?? {}) as SlabLikeConfig;
  const slabs = cfg.slabs ?? [];

  // NSV / phasing / quarterly — percentage slabs with cumulative payout.
  if (slabs.length && slabs[0].pct != null) {
    const earnings = computeSlabEarnings(slabs as NsvSlab[], cfg.stepMode ?? "stepup");
    const tiers: RuleTier[] = [{ minVal: 0, maxVal: slabs[0].pct ?? 0, payout: 0 }];
    slabs.forEach((s, i) => {
      tiers.push({
        minVal: s.pct ?? 0,
        maxVal: i + 1 < slabs.length ? slabs[i + 1].pct ?? 9999 : 9999,
        payout: Math.round(earnings[i]?.cumulative ?? 0),
      });
    });
    return tiers;
  }

  // Simple slabs (collection, new_outlets, …) — threshold → absolute payout.
  if (slabs.length && slabs[0].threshold != null) {
    const tiers: RuleTier[] = [{ minVal: 0, maxVal: slabs[0].threshold ?? 0, payout: 0 }];
    slabs.forEach((s, i) => {
      tiers.push({
        minVal: s.threshold ?? 0,
        maxVal: i + 1 < slabs.length ? slabs[i + 1].threshold ?? 9999 : 9999,
        payout: Math.round(s.payout ?? 0),
      });
    });
    return tiers;
  }

  // ECO — outlet-count slabs with cumulative per-outlet rate.
  if (slabs.length && slabs[0].count != null) {
    const tiers: RuleTier[] = [{ minVal: 0, maxVal: slabs[0].count ?? 0, payout: 0 }];
    let cum = 0;
    let prevCount = 0;
    slabs.forEach((s, i) => {
      cum += ((s.count ?? 0) - prevCount) * (s.ratePerOutlet ?? 0);
      prevCount = s.count ?? 0;
      tiers.push({
        minVal: s.count ?? 0,
        maxVal: i + 1 < slabs.length ? slabs[i + 1].count ?? 9999 : 9999,
        payout: Math.round(cum),
      });
    });
    return tiers;
  }

  // Lines (TLSD / DBB) — min..max lines at a per-line rate.
  if (cfg.minLines != null && cfg.maxLines != null) {
    const top = Math.round(cfg.maxLines * (cfg.ratePerLine ?? 0));
    return [
      { minVal: 0, maxVal: cfg.minLines, payout: 0 },
      { minVal: cfg.minLines, maxVal: cfg.maxLines, payout: top },
      { minVal: cfg.maxLines, maxVal: 9999, payout: top },
    ];
  }

  // Fallback — one tier capped at the template's max payout.
  const max = KPI_TEMPLATE_MAP[templateId]?.maxPayout(config) ?? 0;
  return [{ minVal: 0, maxVal: 9999, payout: Math.round(max ?? 0) }];
}

/** Minimum achievement % to earn anything: a pct gate if present, else the KPI's entry slab. */
function minAchievementPct(templateId: KpiTemplateId, config: unknown, gates: GateRule[]): number {
  for (const gate of gates ?? []) {
    for (const c of gate.conditions ?? []) {
      if (typeof c.value === "number" && /pct|%/i.test(c.unit ?? "")) return c.value;
    }
  }
  const cfg = (config ?? {}) as SlabLikeConfig;
  const first = cfg.slabs?.[0];
  return first?.pct ?? 0;
}

function emptyProductFilter(): ProductFilter {
  return {
    categories: [],
    brands: [],
    skuGroups: [],
    skuIds: [],
    coreSkusOnly: false,
    excludeVariants: [],
  };
}

/* ─── Entry point ────────────────────────────────────────────────────────── */

/** Build one POST `/v1/rules` payload per KPI in the program. */
export function buildRulePayloads(state: BuilderState): RuleApiPayload[] {
  const { basics, audience, channels, gates, programKpis } = state;
  const { from, till } = periodRange(basics);
  const ruleName = basics.name?.trim() || "Untitled programme";
  const applicabilityCriteria = buildApplicabilityCriteria(audience, channels ?? []);
  const roles = audience.roles ?? [];
  const calculationFrequency = FREQ_BY_PERIOD[basics.period] ?? "MONTHLY";
  const multi = programKpis.length > 1;

  return programKpis.map((kpi, i) => {
    const kpiType = KPI_TYPE_BY_TEMPLATE[kpi.templateId] ?? "SALES_TARGET";
    const meta = KPI_TEMPLATE_MAP[kpi.templateId]?.meta;
    // Engine base KPI name from the KPI config (falls back to the display name).
    const baseKpiName = meta?.baseKpiName ?? meta?.name ?? kpi.templateId;
    // Engine KPI code from the KPI config (falls back to the template id).
    const kpiCode = meta?.kpiCode ?? kpi.templateId;

    return {
      lobId: LOB_ID,
      ruleName,
      ruleCode: `RULE-${from}${multi ? `-${i + 1}` : ""}`,
      ruleType: "SLAB",
      calculationFrequency,
      kpiCombination: kpiType,
      effectiveFrom: from,
      effectiveTill: till,
      priority: 1,
      status: "DRAFT",
      isActive: true,
      applicabilityCriteria,
      kpiConditions: { minAchievementPct: minAchievementPct(kpi.templateId, kpi.config, gates) },
      ruleDefinition: { kpiCode, payoutType: "CASH", tiers: tiersFor(kpi.templateId, kpi.config) },
      kpiConfig: {
        kpiType,
        name: `${ruleName} – ${kpiType}`,
        baseKpiName,
        enabled: true,
        userFilters: { roles, properties: {} },
        scopeConfig: { productFilter: emptyProductFilter() },
        calculationConfig: { aggregationFunction: "SUM", metricField: "sales_amount" },
        templateId: kpi.templateId,
        templateConfig: kpi.config,
        ...(kpi.customName ? { customName: kpi.customName } : {}),
        ...(kpi.scope ? { scope: kpi.scope } : {}),
        ...(kpi.groupIds ? { groupIds: kpi.groupIds } : {}),
      },
    };
  });
}
