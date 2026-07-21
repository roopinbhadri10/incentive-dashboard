// Maps the incentive wizard's BuilderState (everything the user typed into the
// "Create New Program" form) onto the rules-engine POST payload accepted by
// `POST /v1/rules`. One API rule is emitted per KPI the user added — a
// single-KPI program produces exactly one rule object.

import type {
  AudienceV2State,
  BasicsState,
  BuilderState,
  GateCondition,
  GateConsequence,
  GateOperator,
  GateRule,
  ProgramKpi,
  ProgrammePeriod,
} from "@/components/wizard/builderState";
import { KPI_TEMPLATE_MAP, type KpiTemplateId } from "@/components/kpi-library/registry";
import { getRolePayloadValue, getRoleDesignation } from "@/lib/saleshubApi";
import { getTenantId } from "@/config/auth";
import {
  computeSlabEarnings,
  type NsvSlab,
  type GateCondition as KpiGateCondition,
  type GateConsequence as KpiGateConsequence,
  type GateThresholdUnit,
} from "@/components/kpi-library/nsvTypes";

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
 * Applicability split into groups:
 *  - user_filters:    who (division, role, geography — zone/state/city).
 *  - outlet_filters:  where (trade channel, and the role-specific outlet_type
 *    sourced from the role config).
 *  - product_filters: what (category/brand/SKU). Optional — only emitted when the
 *    program scopes products. Left unset by the wizard today.
 */
export interface ApplicabilityCriteria {
  user_filters: FilterGroup;
  outlet_filters: FilterGroup;
  product_filters?: FilterGroup;
}

/**
 * One emitted payout tier — an explicit `[min, max)` achievement range. `max` is
 * the next tier's `min` (the boundary the tier runs until); the final tier is
 * open-ended (`max: null`). `payoutType` is always "FIXED". In step-up mode
 * `payoutValue` is the ₹-per-1% rate over the previous boundary; otherwise it is
 * the absolute payout for the range.
 */
export interface RuleTier {
  min: number;
  max: number | null;
  payoutType: "FIXED";
  payoutValue: number;
}

/** Raw tier as derived from a slab config, before being projected onto ranges. */
interface RawTier {
  min: number;
  payoutValue: number;
}

/** The payout-curve portion of ruleDefinition derived from a KPI's slab config. */
interface RuleDefinitionPayout {
  // Emitted on ruleDefinition. True for every per-unit/linear curve — step-up %,
  // per-outlet (eco) and per-line (lines) — so the engine multiplies the rate by
  // the units in the band rather than treating it as a fixed payout.
  stepUpBy1Percent: boolean;
  // % step-up only: a band's rate leads UP to the NEXT slab (the 100%-row rate is
  // for the 95→100 band), so the range projection shifts rates by one. Per-outlet /
  // per-line curves keep each band's own rate, so they leave this false.
  rateLeadsNextSlab?: boolean;
  startingEarning?: number;
  tiers: RawTier[];
  // Whether to emit the open-ended `max: null` tier past the top boundary. Driven by
  // the KPI's cap toggle (cap.enabled); lines always cap (maxLines is structural).
  // When false, only the bounded `[min, max)` ranges are emitted.
  emitTail?: boolean;
  // Cap-aware flows (step-up %, outlet-count): the final (tail) tier always survives,
  // but its `max` is bounded to this cap value when capping is enabled, or left open
  // (`null`) when it is not. Undefined for flows that don't bound the tail this way.
  capMax?: number | null;
  // When the tail is emitted in a non-step-up flow, whether it earns 0 (a hard cap to
  // zero, e.g. lines) instead of holding the last range's payout (slab/threshold/eco).
  zeroTail?: boolean;
  // True when the tiers represent line counts (TLSD / DBB "Lines-based earning")
  // rather than achievement % or amounts. Surfaced as a flag on ruleDefinition.
  lineBased?: boolean;
}

/**
 * A KPI configuration object as the engine now models it — a first-class entity
 * referenced by the rule (and by each gate condition). snake_case keys mirror the
 * engine's contract. `calculation_logic` is only emitted for the rule's primary
 * KPI (carries the period cut-off); gate KPIs omit it. `user_filters` /
 * `outlet_filters` repeat the rule's applicability so the KPI is independently
 * scoped.
 */
export interface KpiConfigPayload {
  name: string;
  description: string;
  frequency: string;
  // Approval status of the auto-generated KPI config.
  status: string;
  // Engine base KPI name (e.g. "TARGET_VS_ACHIEVEMENT", "ECO").
  base_kpi_name: string;
  // KPI classification — "BASE" for the rule's primary KPI; gate KPIs carry their
  // own type (e.g. "EFFECTIVE_COVERAGE").
  kpi_type: string;
  is_enabled: boolean;
  // Period cut-off (ISO, end of the effective window). Primary KPI only.
  calculation_logic?: { cutoff_date: string };
  user_filters: FilterGroup;
  outlet_filters: FilterGroup;
}

/**
 * Gate KPI config — the same entity as KpiConfigPayload, but the gate contract
 * expects camelCase keys for three fields where the primary kpiConfig uses
 * snake_case: baseKpiName / kpiType / enabled (vs. base_kpi_name / kpi_type /
 * is_enabled). Everything else matches KpiConfigPayload.
 */
export interface GateKpiConfigPayload {
  name: string;
  description: string;
  frequency: string;
  status: string;
  baseKpiName: string;
  kpiType: string;
  enabled: boolean;
  calculation_logic?: { cutoff_date: string };
  user_filters: FilterGroup;
  outlet_filters: FilterGroup;
}

/** Engine comparator for a gate threshold. */
export type GateComparator = "GT" | "GTE" | "LT" | "LTE" | "EQ" | "BETWEEN";

/** What happens to the payout when a gate is NOT satisfied. */
export type GateConsequenceType =
  | "ZERO_PAYOUT"
  | "ZERO_PAYOUT_KPIS"
  | "LIMIT_PAYOUT_PCT"
  | "CUSTOM";

/** How the threshold is interpreted (the gate KPI's unit). */
export type GateEvaluationBasis = "PERCENTAGE" | "AMOUNT" | "COUNT" | "DAYS";

/**
 * One gate condition attached to the rule. Each wizard gate condition becomes one
 * of these, carrying its parent gate's consequence. Server-assigned ids
 * (id / ruleId / gateKpiConfigId) are omitted on POST — the engine assigns them.
 */
export interface GateConditionPayload {
  // Engine code of the gated KPI (e.g. "ECO").
  gateKpiCode: string;
  threshold: number;
  comparator: GateComparator;
  consequenceType: GateConsequenceType;
  // Shape depends on consequenceType (e.g. { limitToPct } for LIMIT_PAYOUT_PCT).
  consequenceConfig: Record<string, unknown>;
  evaluationBasis: GateEvaluationBasis;
  priority: number;
  isActive: boolean;
  // Full KPI config the gate evaluates against (gate-contract camelCase keys).
  gateKpiConfig: GateKpiConfigPayload;
}

export interface RuleApiPayload {
  // Tenant the rule belongs to (also sent in the X-Tenant-Id header).
  tenantId: string;
  ruleName: string;
  ruleCode: string;
  ruleType: string;
  calculationFrequency: string;
  kpiCombination: string;
  // Reference to the created KPI config. Server-assigned — omitted on POST.
  kpiConfigId?: string;
  effectiveFrom: string;
  effectiveTill: string;
  priority: number;
  status: string;
  isActive: boolean;
  applicabilityCriteria: ApplicabilityCriteria;
  ruleDefinition: {
    kpiCode: string;
    // KPI instance id from the KPI config (falls back to the template id).
    kpiId: string;
    // Human-readable KPI name (custom name, else the template's display name).
    kpiName: string;
    stepUpBy1Percent: boolean;
    startingEarning?: number;
    // Max earning achievable for this KPI — the top of the staircase/tier curve
    // (same value the wizard surfaces as the KPI's "max earning").
    maxEarning: number;
    keyRules: string[];
    // Phasing cut-off — only present when the KPI defines a cut-off day;
    // resolves the day-of-month to DD-MM-YYYY for the rule's period.
    cutOfDate?: string;
    // Present and true only for line-count KPIs (TLSD / DBB "Lines-based earning").
    lineBasedEarning?: boolean;
    // Minimum bill value threshold (outlet-count KPIs) — only when the threshold is enabled.
    minBillAmount?: number;
    // Minimum qty for a line to qualify (line-count KPIs) — only when enabled.
    minQtyValue?: number;
    // Cap (max payable achievement / outlets / …) so the editor can restore the
    // toggle + value. `value` is the KPI-specific cap amount (pct / outlets / …).
    cap?: { enabled: boolean; value: number | null };
    tiers: RuleTier[];
  };
  // The rule's primary KPI config (first-class entity, snake_case contract).
  kpiConfig: KpiConfigPayload;
  // Gate conditions — one per wizard gate condition. Empty when no gates.
  gateConditions: GateConditionPayload[];
}

/* ─── Config-derived values that have no direct form field default to these. ── */

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
  // user_filters — who: role, salesOrg (the division), and geography
  // (zone / state / city; the bare "geography" catch-all is dropped).
  const userRules: FilterRule[] = [];
  const role = audience.roles?.[0];
  if (role) {
    // Map the selected role onto its API designation (e.g. all *MR roles → "mr").
    const designation = getRoleDesignation(role) || role;
    userRules.push(toFilterRule("designation", [designation]));
  }
  // Division lives on the user, keyed as salesOrg.
  if (audience.division) {
    userRules.push(toFilterRule("salesOrg", [audience.division]));
  }
  for (const [field, values] of Object.entries(parseGeoTags(audience.geographies))) {
    if (field === "geography") continue;
    userRules.push(toFilterRule(field, values, "IN"));
  }
  for (const [field, values] of Object.entries(parseGeoTags(audience.geographyExceptions))) {
    if (field === "geography") continue;
    userRules.push(toFilterRule(field, values, "NOT_IN"));
  }

  // outlet_filters — where: trade channels and the role-specific marketType
  // sourced from the role config (role_payload_value_configuration).
  const outletRules: FilterRule[] = [];
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
  keyNotes?: string[];
  // Outlet-count KPIs — minimum bill value threshold (only meaningful when enabled).
  minBillEnabled?: boolean;
  minBillAmount?: number;
  // Line-count KPIs — minimum qty for a line to qualify (only meaningful when enabled).
  minQtyEnabled?: boolean;
  minQtyValue?: number;
  cutoffDay?: number; // phasing KPIs — day-of-month cut-off (e.g. 20).
  // Cap toggle — shape varies by KPI (pct / value / outlets), but every variant
  // carries `enabled`. Drives whether an open-ended tail tier is emitted. The cap
  // value lives under a KPI-specific key: `pct` for step-up % KPIs (max payable
  // achievement), `outlets` for outlet-count KPIs (max payable outlets).
  cap?: { enabled?: boolean; pct?: number; outlets?: number };
}

/**
 * Convert a KPI's slab structure into the engine's payout curve: a list of
 * {min, payoutValue} tiers plus the step-up flag / starting earning. Tiers start
 * at the first real boundary (no synthetic 0-floor tier — each tier applies until
 * the next tier's `min`).
 */
function buildPayout(templateId: KpiTemplateId, config: unknown): RuleDefinitionPayout {
  const cfg = (config ?? {}) as SlabLikeConfig;
  const slabs = cfg.slabs ?? [];
  // The open tail is emitted only when the KPI's cap is enabled.
  const emitTail = cfg.cap?.enabled === true;

  // NSV / phasing / quarterly — percentage slabs.
  if (slabs.length && slabs[0].pct != null) {
    if ((cfg.stepMode ?? "stepup") === "stepup") {
      // Step-up: startingEarning at the entry slab, then ₹-per-1% rate per slab.
      // The open tail is always kept; its `max` is the cap % when capping is on,
      // else null (unbounded achievement past the top slab).
      return {
        stepUpBy1Percent: true,
        rateLeadsNextSlab: true,
        startingEarning: Math.round(slabs[0].entryPayout ?? 0),
        emitTail,
        capMax: cfg.cap?.enabled === true ? cfg.cap.pct ?? null : null,
        tiers: slabs.map((s, i) => ({
          min: s.pct ?? 0,
          payoutValue: i === 0 ? 0 : Math.round(s.ratePerPct ?? 0),
        })),
      };
    }
    // Pure slab — absolute (cumulative) payout at each % boundary.
    const earnings = computeSlabEarnings(slabs as NsvSlab[], "slab");
    return {
      stepUpBy1Percent: false,
      emitTail,
      tiers: slabs.map((s, i) => ({
        min: s.pct ?? 0,
        payoutValue: Math.round(earnings[i]?.cumulative ?? 0),
      })),
    };
  }

  // Simple slabs (collection, new_outlets, …) — threshold → absolute payout.
  if (slabs.length && slabs[0].threshold != null) {
    return {
      stepUpBy1Percent: false,
      emitTail,
      tiers: slabs.map((s) => ({
        min: s.threshold ?? 0,
        payoutValue: Math.round(s.payout ?? 0),
      })),
    };
  }

  // ECO — outlet-count slabs. Each band carries its own ₹-per-outlet rate (the
  // value the user typed), not a cumulative earning — mirroring how step-up %
  // emits the ₹-per-1% rate rather than the computed payout.
  if (slabs.length && slabs[0].count != null) {
    return {
      // Per-outlet rate is linear in outlet count → step-up. The range projection
      // keeps each band's own rate (rateLeadsNextSlab stays false).
      stepUpBy1Percent: true,
      emitTail,
      // The tail is bounded to the cap (max payable outlets) when capping is on,
      // else left open (max: null).
      capMax: cfg.cap?.enabled === true ? cfg.cap.outlets ?? null : null,
      tiers: slabs.map((s) => ({
        min: s.count ?? 0,
        payoutValue: Math.round(s.ratePerOutlet ?? 0),
      })),
    };
  }

  // Lines (TLSD / DBB) — min..max lines, each line earning the ₹-per-line rate (the
  // value the user typed), not the computed top payout. maxLines is a structural
  // hard cap, so the open tail is always emitted and earns 0 — nothing past maxLines.
  if (cfg.minLines != null && cfg.maxLines != null) {
    const rate = Math.round(cfg.ratePerLine ?? 0);
    return {
      // Per-line rate is linear in line count → step-up. Each band keeps its own
      // rate (rateLeadsNextSlab stays false); the open tail past maxLines earns 0.
      stepUpBy1Percent: true,
      emitTail: true,
      zeroTail: true,
      lineBased: true,
      tiers: [
        { min: cfg.minLines, payoutValue: rate },
        { min: cfg.maxLines, payoutValue: rate },
      ],
    };
  }

  // Fallback — one tier capped at the template's max payout.
  const max = KPI_TEMPLATE_MAP[templateId]?.maxPayout(config) ?? 0;
  return {
    stepUpBy1Percent: false,
    tiers: [{ min: 0, payoutValue: Math.round(max ?? 0) }],
  };
}

/**
 * Project raw tiers onto the engine's range format: each tier becomes an explicit
 * `[min, max)` range with `payoutType: "FIXED"`, where `max` is the next tier's
 * `min` and the final tier is open-ended (`max: null`).
 *
 * The payout a range carries depends on the mode:
 *  • Step-up — the ₹-per-1% rate belongs to the band leading UP to a slab (the rate
 *    on the 100% row is for the 95→100 band), so a range `[min_i, max_i)` takes the
 *    next tier's rate. Nothing is earned past the top slab, so the open tail is 0.
 *  • Pure-slab/FIXED — the payout sits on the band's own lower boundary, so a range
 *    keeps its own value.
 *
 * The open-ended `max: null` tier is emitted only when `emitTail` is set (the KPI's
 * cap is enabled, or lines). When emitted its value is 0 for step-up and `zeroTail`
 * flows (hard cap to zero, e.g. lines); otherwise the tail simply keeps the last
 * tier's own payout. Without `emitTail`, only the bounded `[min, max)` ranges are
 * kept — but a lone tier always survives (the list is never emptied).
 *
 * Cap-aware flows (step-up %, outlet-count) pass `capMax` and always keep their
 * tail; `capMax` decides that tail's `max`: the cap value when capping is enabled,
 * or null (unbounded) when it is not.
 */
function toRangeTiers(
  tiers: RawTier[],
  {
    stepUp,
    emitTail,
    zeroTail,
    capMax,
  }: { stepUp: boolean; emitTail: boolean; zeroTail: boolean; capMax?: number | null },
): RuleTier[] {
  // Cap-aware flows opt into the bounded/open tail by passing `capMax` (number or null).
  const capAware = capMax !== undefined;
  const ranges = tiers.map((t, i) => {
    const isLast = i === tiers.length - 1;
    const isTail = isLast && tiers.length > 1;
    let payoutValue: number;
    if (stepUp) {
      // A step-up band carries the rate leading up to the NEXT slab. The tail tier
      // keeps earning at the last band's own rate — whether bounded by a cap or left
      // open (max: null). Only line-based KPIs (zeroTail) drop the tail to 0.
      payoutValue = isLast ? t.payoutValue : tiers[i + 1].payoutValue;
    } else if (isTail && zeroTail) {
      payoutValue = 0;
    } else {
      payoutValue = t.payoutValue;
    }
    // Cap-aware flows bound the open tail to the cap value when capping is on;
    // otherwise (and for non-cap-aware flows) the last tier stays open-ended.
    const max = isLast ? (capAware ? capMax ?? null : null) : tiers[i + 1].min;
    return {
      min: t.min,
      max,
      payoutType: "FIXED" as const,
      payoutValue,
    };
  });
  // Cap-aware flows always keep their tail (its `max` already encodes the cap, or
  // null when uncapped). For other flows the open tail survives only when emitTail
  // is set; otherwise keep just the bounded ranges — but never empty the list.
  const result = capAware || emitTail || ranges.length <= 1 ? ranges : ranges.slice(0, -1);
  // When a cap is enabled, nothing is earned beyond it — append an explicit open
  // tail at 0 from the cap boundary onward.
  if (capAware && capMax != null) {
    result.push({ min: capMax, max: null, payoutType: "FIXED", payoutValue: 0 });
  }
  return result;
}

/**
 * Build a KPI config entity in the engine's snake_case contract. Used for the
 * rule's primary KPI and for each gate KPI. `user_filters` / `outlet_filters`
 * repeat the rule's applicability so the KPI is independently scoped.
 */
function buildKpiConfig(args: {
  name: string;
  description: string;
  frequency: string;
  baseKpiName: string;
  kpiType: string;
  criteria: ApplicabilityCriteria;
  cutoffDate?: string;
}): KpiConfigPayload {
  return {
    name: args.name,
    description: args.description,
    frequency: args.frequency,
    status: "APPROVED",
    base_kpi_name: args.baseKpiName,
    kpi_type: args.kpiType,
    is_enabled: true,
    ...(args.cutoffDate ? { calculation_logic: { cutoff_date: args.cutoffDate } } : {}),
    user_filters: args.criteria.user_filters,
    outlet_filters: args.criteria.outlet_filters,
  };
}

/**
 * Rename a KPI config onto the gate contract's key names: the gate shape uses
 * camelCase baseKpiName / kpiType / enabled where the primary kpiConfig uses
 * snake_case base_kpi_name / kpi_type / is_enabled.
 */
function toGateKpiConfig(cfg: KpiConfigPayload): GateKpiConfigPayload {
  return {
    name: cfg.name,
    description: cfg.description,
    frequency: cfg.frequency,
    status: cfg.status,
    baseKpiName: cfg.base_kpi_name,
    kpiType: cfg.kpi_type,
    enabled: cfg.is_enabled,
    ...(cfg.calculation_logic ? { calculation_logic: cfg.calculation_logic } : {}),
    user_filters: cfg.user_filters,
    outlet_filters: cfg.outlet_filters,
  };
}

// Wizard gate operator → engine comparator. The wizard offers no ≥/≤, so the
// strict variants map across directly (lt→LT, gt→GT); a "between" gate uses its
// lower bound with BETWEEN (the upper bound has no field in the gate-condition shape).
const COMPARATOR_BY_OP: Record<GateOperator, GateComparator> = {
  lt: "LT",
  gt: "GT",
  eq: "EQ",
  between: "BETWEEN",
};

/** Gate condition unit → how the engine interprets the threshold. */
function evaluationBasisFor(unit: string | undefined): GateEvaluationBasis {
  const u = (unit ?? "").toLowerCase();
  if (u === "%" || u === "pct") return "PERCENTAGE";
  if (u === "₹") return "AMOUNT";
  if (u === "days") return "DAYS";
  if (u === "count") return "COUNT";
  return "PERCENTAGE";
}

/**
 * Map a wizard gate consequence onto the engine's consequenceType + config:
 *  • reduce    → LIMIT_PAYOUT_PCT { limitToPct, [scope] }
 *  • zero-kpis → ZERO_PAYOUT_KPIS { kpiIds }
 *  • custom    → CUSTOM { text }
 *  • zero-all  → ZERO_PAYOUT {}
 */
function consequenceFor(c: GateConsequence): {
  consequenceType: GateConsequenceType;
  consequenceConfig: Record<string, unknown>;
} {
  switch (c.kind) {
    case "reduce":
      return {
        consequenceType: "LIMIT_PAYOUT_PCT",
        consequenceConfig: {
          limitToPct: c.percent,
          ...(c.scope && c.scope !== "all" ? { scope: c.scope } : {}),
        },
      };
    case "zero-kpis":
      return { consequenceType: "ZERO_PAYOUT_KPIS", consequenceConfig: { kpiIds: c.kpiIds } };
    case "custom":
      return { consequenceType: "CUSTOM", consequenceConfig: { text: c.text } };
    case "zero-all":
    default:
      return { consequenceType: "ZERO_PAYOUT", consequenceConfig: {} };
  }
}

/**
 * Resolve a gate condition's metric onto an engine KPI code + type. When the gate
 * targets one of the programme's own KPIs (metricGroup "kpi", metric = its
 * instance/template id) we read the code/type from the KPI catalog; otherwise the
 * metric label is used as the code and the metric group becomes the type.
 */
function gateKpiIdentity(
  metricGroup: string,
  metric: string,
  programKpis: ProgramKpi[],
): { code: string; kpiType: string } {
  if (metricGroup === "kpi") {
    const match = programKpis.find(
      (k) => k.instanceId === metric || k.templateId === metric,
    );
    if (match) {
      const meta = KPI_TEMPLATE_MAP[match.templateId]?.meta;
      const code = meta?.baseKpiName ?? meta?.kpiCode ?? match.templateId;
      return { code, kpiType: KPI_TYPE_BY_TEMPLATE[match.templateId] ?? "BASE" };
    }
  }
  return {
    code: metric,
    kpiType: (metricGroup || "custom").toUpperCase(),
  };
}

/**
 * Build the rule's gate conditions from the wizard's gate rules. Each gate may
 * hold several conditions joined by AND/OR plus one consequence; we emit one
 * gateCondition per condition, all carrying that gate's consequence (the new
 * gate-condition shape has no joiner field, so a multi-condition gate flattens).
 */
function buildGateConditions(
  gates: GateRule[],
  ctx: {
    ruleName: string;
    ruleCode: string;
    frequency: string;
    criteria: ApplicabilityCriteria;
    programKpis: ProgramKpi[];
  },
): GateConditionPayload[] {
  const out: GateConditionPayload[] = [];
  for (const gate of gates ?? []) {
    const { consequenceType, consequenceConfig } = consequenceFor(gate.consequence);
    for (const c of gate.conditions ?? []) {
      const { code, kpiType } = gateKpiIdentity(c.metricGroup, c.metric, ctx.programKpis);
      out.push({
        gateKpiCode: code,
        threshold: c.value,
        comparator: COMPARATOR_BY_OP[c.operator] ?? "GTE",
        consequenceType,
        consequenceConfig,
        evaluationBasis: evaluationBasisFor(c.unit),
        priority: out.length,
        isActive: true,
        gateKpiConfig: toGateKpiConfig(
          buildKpiConfig({
            name: `${ctx.ruleName} – ${code} Gate`,
            description: `Gate KPI for rule ${ctx.ruleCode}`,
            frequency: ctx.frequency,
            baseKpiName: code,
            kpiType,
            criteria: ctx.criteria,
          }),
        ),
      });
    }
  }
  return out;
}

// KPI-level gate threshold unit → engine evaluation basis. The KPI-level gate
// offers pct / amount / count (no "days" variant).
const KPI_GATE_BASIS: Record<GateThresholdUnit, GateEvaluationBasis> = {
  pct: "PERCENTAGE",
  amount: "AMOUNT",
  count: "COUNT",
};

/** Map a KPI-level gate consequence onto the engine's consequenceType + config. */
function kpiGateConsequence(c: KpiGateConsequence): {
  consequenceType: GateConsequenceType;
  consequenceConfig: Record<string, unknown>;
} {
  if (c.kind === "limit") {
    return { consequenceType: "LIMIT_PAYOUT_PCT", consequenceConfig: { limitToPct: c.pct } };
  }
  // "zero" — each KPI is emitted as its own rule, so zeroing the rule's payout
  // zeros exactly this KPI.
  return { consequenceType: "ZERO_PAYOUT", consequenceConfig: {} };
}

/**
 * Build the gate conditions authored on a single KPI (kpi.config.gates, edited in
 * the KPI form). These apply to that KPI's rule only — unlike the program-level
 * gates, which every KPI's rule repeats. `startPriority` continues the priority
 * numbering after the program-level gates already on the rule.
 *
 * The dependency is stored as the shared composite value (`kpi::<id>`,
 * `<group>::<metric>`, `custom::<name>`); a bare legacy value (no "::") is treated
 * as a KPI id. A KPI-level gate has no operator — passing means the dependent
 * metric reaches the threshold, so the comparator is always GTE.
 */
function buildKpiLevelGateConditions(
  kpi: ProgramKpi,
  ctx: {
    ruleName: string;
    ruleCode: string;
    frequency: string;
    criteria: ApplicabilityCriteria;
    programKpis: ProgramKpi[];
    startPriority: number;
  },
): GateConditionPayload[] {
  const cfg = (kpi.config ?? {}) as { gatesEnabled?: boolean; gates?: KpiGateCondition[] };
  if (!cfg.gatesEnabled || !cfg.gates?.length) return [];
  return cfg.gates.map((g, i) => {
    const raw = g.dependsOnKpiId ?? "";
    const [group, ...rest] = raw.includes("::") ? raw.split("::") : ["kpi", raw];
    const metric = rest.join("::");
    const { code, kpiType } = gateKpiIdentity(group, metric, ctx.programKpis);
    const { consequenceType, consequenceConfig } = kpiGateConsequence(g.consequence);
    return {
      gateKpiCode: code,
      threshold: g.thresholdValue,
      comparator: "GTE",
      consequenceType,
      consequenceConfig,
      evaluationBasis: KPI_GATE_BASIS[g.thresholdUnit] ?? "PERCENTAGE",
      priority: ctx.startPriority + i,
      isActive: true,
      gateKpiConfig: toGateKpiConfig(
        buildKpiConfig({
          name: `${ctx.ruleName} – ${code} Gate`,
          description: `Gate KPI for rule ${ctx.ruleCode}`,
          frequency: ctx.frequency,
          baseKpiName: code,
          kpiType,
          criteria: ctx.criteria,
        }),
      ),
    };
  });
}

/* ─── Entry point ────────────────────────────────────────────────────────── */

/** Build one POST `/v1/rules` payload per KPI in the program. */
export function buildRulePayloads(state: BuilderState): RuleApiPayload[] {
  const { basics, audience, channels, gates, programKpis } = state;
  const { from, till } = periodRange(basics);
  const ruleName = basics.name?.trim() || "Untitled programme";
  const applicabilityCriteria = buildApplicabilityCriteria(audience, channels ?? []);
  const calculationFrequency = FREQ_BY_PERIOD[basics.period] ?? "MONTHLY";
  const multi = programKpis.length > 1;

  return programKpis.map((kpi, i) => {
    const meta = KPI_TEMPLATE_MAP[kpi.templateId]?.meta;
    // Engine base KPI name from the KPI section config (falls back to the display
    // name). Used as both kpiCombination and ruleDefinition.kpiCode.
    const baseKpiName = meta?.baseKpiName ?? meta?.name ?? kpi.templateId;
    // Engine KPI code from the KPI config (falls back to the template id).
    const kpiCode = meta?.kpiCode ?? kpi.templateId;
    // KPI instance id from the KPI config (falls back to the template id).
    const kpiId = meta?.id ?? kpi.templateId;
    // Human-readable KPI name — the instance's custom name, else the template name.
    const kpiName = kpi.customName?.trim() || meta?.name || kpiCode;
    const payout = buildPayout(kpi.templateId, kpi.config);
    // maxPayout already folds in the cap-extension diff for cap-aware flows
    // (step-up %, outlet-count), so the payload, edit view, and reports agree.
    const maxEarning = Math.round(KPI_TEMPLATE_MAP[kpi.templateId]?.maxPayout(kpi.config) ?? 0);
    const keyRules = (kpi.config as SlabLikeConfig).keyNotes ?? [];
    const ruleCode = `RULE-${from}${multi ? `-${i + 1}` : ""}`;
    // Period cut-off for the KPI config — end of the effective window.
    const cutoffDate = `${till}T23:59:59Z`;
    // Program-level gates apply to every KPI's rule; this KPI's own gates apply
    // to this rule only, appended after them (continuing the priority order).
    const gateConditions = buildGateConditions(gates, {
      ruleName,
      ruleCode,
      frequency: calculationFrequency,
      criteria: applicabilityCriteria,
      programKpis,
    });
    gateConditions.push(
      ...buildKpiLevelGateConditions(kpi, {
        ruleName,
        ruleCode,
        frequency: calculationFrequency,
        criteria: applicabilityCriteria,
        programKpis,
        startPriority: gateConditions.length,
      }),
    );
    // Phasing cut-off: resolve the day-of-month onto the rule's month/year
    // (from = "YYYY-MM-DD") as DD-MM-YYYY, e.g. day 20 in Jun 2026 → "20-06-2026".
    const cutoffDay = (kpi.config as SlabLikeConfig).cutoffDay;
    const cutoff =
      cutoffDay != null
        ? { cutOfDate: `${pad2(cutoffDay)}-${from.slice(5, 7)}-${from.slice(0, 4)}` }
        : {};
    // Minimum bill value threshold (outlet-count KPIs) — emitted only when enabled.
    const cfg = kpi.config as SlabLikeConfig;
    const minBill =
      cfg.minBillEnabled && cfg.minBillAmount != null ? { minBillAmount: cfg.minBillAmount } : {};
    // Minimum qty to qualify a line (line-count KPIs) — emitted only when enabled.
    const minQty =
      cfg.minQtyEnabled && cfg.minQtyValue != null ? { minQtyValue: cfg.minQtyValue } : {};
    // Cap (max payable achievement / outlets / …) — carry the toggle + value so the
    // editor can restore it. The cap amount lives under a KPI-specific key; take the
    // first numeric non-`enabled` entry (pct / outlets / value / lines / …).
    const capRaw = (kpi.config as { cap?: Record<string, unknown> }).cap;
    const cap =
      capRaw && typeof capRaw === "object"
        ? {
            cap: {
              enabled: !!capRaw.enabled,
              value: (Object.entries(capRaw).find(
                ([k, v]) => k !== "enabled" && typeof v === "number"
              )?.[1] ?? null) as number | null,
            },
          }
        : {};

    return {
      tenantId: getTenantId(),
      ruleName,
      ruleCode,
      ruleType: "SLAB",
      calculationFrequency,
      kpiCombination: baseKpiName,
      effectiveFrom: from,
      effectiveTill: till,
      priority: 1,
      status: "DRAFT",
      isActive: true,
      applicabilityCriteria,
      ruleDefinition: {
        kpiCode: baseKpiName,
        kpiId,
        kpiName,
        stepUpBy1Percent: payout.stepUpBy1Percent,
        ...(payout.startingEarning != null ? { startingEarning: payout.startingEarning } : {}),
        maxEarning,
        keyRules,
        ...cutoff,
        ...minBill,
        ...minQty,
        ...cap,
        ...(payout.lineBased ? { lineBasedEarning: true } : {}),
        tiers: toRangeTiers(payout.tiers, {
          // Only % step-up shifts a band's rate to the next slab; per-outlet/per-line
          // curves keep their own rate even though they emit stepUpBy1Percent: true.
          stepUp: payout.rateLeadsNextSlab ?? false,
          emitTail: payout.emitTail ?? false,
          zeroTail: payout.zeroTail ?? false,
          capMax: payout.capMax,
        }),
      },
      kpiConfig: buildKpiConfig({
        name: ruleName,
        description: `Auto-generated from rule ${ruleCode}`,
        frequency: calculationFrequency,
        baseKpiName,
        kpiType: "BASE",
        criteria: applicabilityCriteria,
        cutoffDate,
      }),
      gateConditions,
    };
  });
}
