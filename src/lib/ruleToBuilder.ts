// Reconstruct a wizard BuilderState from a rules-engine record (GET /v1/rules),
// used when cloning or editing a program. Everything is recovered from the rule's
// own API data — no local storage. The KPI config comes from the verbatim copy we
// round-trip in kpiConfig.templateConfig when the engine preserves it (lossless);
// otherwise it is rebuilt from ruleDefinition.tiers (see configFromTiers), which
// reproduces the same payout curve generically for every KPI type. Basics +
// audience are restored from the rule's applicabilityCriteria.

import {
  emptyBuilder,
  uid,
  type BuilderState,
  type Channel,
  type KpiScope,
  type ProgrammePeriod,
} from "@/components/wizard/builderState";
import { KPI_TEMPLATE_MAP, type KpiTemplateId } from "@/components/kpi-library/registry";
import { getKpiCatalog } from "@/components/kpi-library/schema/kpiCatalog";
import type { CatalogEntry } from "@/components/kpi-library/registry";
import { getRoleByPayloadValue, getRoleByDesignation } from "@/lib/saleshubApi";
import type { RuleRecord } from "./ruleApi";

interface RuleTier {
  minVal: number;
  maxVal: number;
  payout: number;
}

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
  TARGET_VS_ACHIEVEMENT: "nsv",
  SALES_TARGET: "nsv",
  COVERAGE: "eco",
  UNIQUE_LINE_COUNT: "tlsd",
  DISTRIBUTION: "tlsd",
  COLLECTION: "collection",
  PRODUCTIVITY: "pcc",
  MUST_SELL_SKU: "must_sell_sku",
  AI_RECOMMENDED_ORDER: "ai_recommended_order",
};

const TAG_PREFIX: Record<string, string> = { zone: "Zone: ", state: "State: ", city: "City: " };

// Only true geography fields become region tags. Everything else in the
// criteria — role/designation, division/outletDivision, channel, marketType,
// outlet_type — belongs to other audience fields and must never leak into the
// Region picker as a chip. Allowlisting (vs the old denylist) keeps any
// future non-geo field out too.
const GEO_PROPS = new Set(["zone", "state", "city", "geography"]);

/** Geography tags (IN conditions → regions, NOT_IN → exceptions). */
function geoTagsFor(conditions: RuleCondition[], exceptions: boolean): string[] {
  const out: string[] = [];
  for (const c of conditions) {
    if ((c.operator === "NOT_IN") !== exceptions) continue;
    if (!GEO_PROPS.has(c.property ?? "")) continue;
    const prefix = TAG_PREFIX[c.property ?? ""] ?? "";
    for (const v of c.values ?? []) out.push(prefix ? `${prefix}${v}` : v);
  }
  return out;
}

function channelsFor(conditions: RuleCondition[]): string[] {
  return conditions.find((c) => c.property === "channel" && c.operator !== "NOT_IN")?.values ?? [];
}

function divisionFor(conditions: RuleCondition[]): Channel | undefined {
  const v = conditions.find(
    (c) => c.property === "outletDivision" || c.property === "division"
  )?.values?.[0];
  return v === "CCD" || v === "HCD" ? v : undefined;
}

function rolesFor(conditions: RuleCondition[]): string[] {
  return conditions.find((c) => c.property === "role")?.values ?? [];
}

/**
 * Recover the audience role from a rule's applicabilityCriteria, independent of
 * the verbatim kpiConfig round-trip (which the engine does not reliably preserve
 * — it strips templateId/templateConfig on every rule and returns a null
 * kpiConfig for some, which is why the role section came back empty on a first
 * edit yet filled in after a refresh re-fetched a fully-persisted record).
 *
 * The payload writes the role into three fields (see buildApplicabilityCriteria
 * in rulePayload.ts). We read them most-reliable first:
 *   1. an explicit `role` condition (older rules; foreign producers),
 *   2. `marketType` (outlet_filters) reverse-mapped — 1:1, so this is EXACT,
 *   3. `designation` (user_filters) reverse-mapped — many-to-one, so only when
 *      it resolves unambiguously, else the raw designation as a visible label.
 */
function rolesFromCriteria(conditions: RuleCondition[]): string[] {
  const explicit = rolesFor(conditions);
  if (explicit.length > 0) return explicit;

  const marketType = conditions.find((c) => c.property === "marketType")?.values?.[0];
  const fromMarketType = marketType ? getRoleByPayloadValue(marketType) : "";
  if (fromMarketType) return [fromMarketType];

  const designation = conditions.find((c) => c.property === "designation")?.values?.[0];
  if (designation) {
    const fromDesignation = getRoleByDesignation(designation);
    return [fromDesignation || designation];
  }
  return [];
}

/**
 * Recover the audience role(s) from a rule. Prefers the verbatim role names the
 * wizard round-trips in kpiConfig (exact, matches the role picker's options),
 * falling back to recovering them from applicabilityCriteria. Shared by
 * ruleToBuilder (audience reconstruction) and ruleToProgramme (the list's role
 * column + filter) so both read the role the same way instead of one of them
 * hardcoding it. Self-contained: re-normalizes the criteria internally.
 */
export function rolesFromRule(rule: RuleRecord): string[] {
  const kpiConfigRoles =
    (rule.kpiConfig as { userFilters?: { roles?: string[] } } | undefined)?.userFilters?.roles ?? [];
  if (kpiConfigRoles.length > 0) return kpiConfigRoles;
  const criteria = (rule.applicabilityCriteria ?? {}) as ApplicabilityCriteria;
  return rolesFromCriteria(normalizeConditions(criteria));
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

/**
 * Normalize a rule's tiers to the legacy cumulative shape configFromTiers expects
 * ({minVal,maxVal,payout} led by a 0-floor tier). Rules created after the payload
 * migration store {min,payoutValue}[ + stepUp/startingEarning]; rebuild their
 * cumulative payout curve from that. Legacy rules pass through unchanged.
 */
export function normalizeRuleTiers(rd: RuleRecord["ruleDefinition"] | undefined): RuleTier[] {
  const raw = rd?.tiers ?? [];
  if (!raw.length) return [];
  // Already the legacy cumulative shape.
  if (raw[0].minVal != null || raw[0].payout != null) {
    return raw.map((t) => ({ minVal: t.minVal ?? 0, maxVal: t.maxVal ?? 9999, payout: t.payout ?? 0 }));
  }
  // New shape → cumulative payout + a synthetic 0-floor tier.
  const out: RuleTier[] = [{ minVal: 0, maxVal: raw[0].min ?? 0, payout: 0 }];
  let cum = rd?.stepUpBy1Percent ? rd.startingEarning ?? 0 : 0;
  raw.forEach((t, i) => {
    if (rd?.stepUpBy1Percent) {
      if (i > 0) cum += ((t.min ?? 0) - (raw[i - 1].min ?? 0)) * (t.payoutValue ?? 0);
    } else {
      cum = t.payoutValue ?? 0; // FIXED tiers carry the absolute payout directly.
    }
    out.push({ minVal: t.min ?? 0, maxVal: raw[i + 1]?.min ?? 9999, payout: Math.round(cum) });
  });
  return out;
}

/**
 * Rebuild a KPI's wizard config from the payout tiers the rules API returns —
 * the inverse of `tiersFor` in rulePayload.ts. The forward step is lossy (it
 * keeps only the payout curve, not the exact rates/mode the user typed), so we
 * reconstruct a config that reproduces the SAME tiers, merged over the template's
 * defaults for fields the tiers don't carry. Generic across KPI types: the slab
 * shape is detected from the template's default config, not hard-coded per id.
 *
 * `rd` carries the non-curve ruleDefinition fields the editor also round-trips —
 * `keyRules` (→ keyNotes) and `stepUpBy1Percent` (→ slab stepMode). Without them
 * the restored config falls back to the template defaults for the key notes and
 * always reads as step-up mode, even when the saved rule was a pure slab.
 */
function configFromTiers(
  tpl: CatalogEntry,
  tiers: RuleTier[] | undefined,
  rd?: RuleRecord["ruleDefinition"],
): unknown {
  const base = tpl.defaultConfig() as Record<string, unknown>;

  // Overlay the ruleDefinition fields that live outside the payout curve. Key
  // notes apply to every KPI type; the saved `keyRules` replace the template
  // defaults whenever the rule carries any (an empty list means "use defaults").
  const withExtras = (cfg: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...cfg };
    if (Array.isArray(rd?.keyRules) && rd.keyRules.length && "keyNotes" in base) {
      out.keyNotes = [...rd.keyRules];
    }
    // Phasing cut-off — the rule stores it as DD-MM-YYYY (see rulePayload.ts);
    // recover just the day-of-month back into cutoffDay.
    if (rd?.cutOfDate && "cutoffDay" in base) {
      const day = Number(rd.cutOfDate.split("-")[0]);
      if (Number.isFinite(day) && day > 0) out.cutoffDay = day;
    }
    return out;
  };

  if (!tiers?.length) return withExtras(base);

  const defSlabs = base.slabs as Array<Record<string, unknown>> | undefined;
  const first = defSlabs?.[0];
  // Tiers always lead with a 0-floor tier {minVal:0, …, payout:0}; the real slabs
  // map to the remaining tiers. A lone fallback tier leaves nothing to rebuild.
  const slabTiers = tiers.slice(1);
  if (Array.isArray(defSlabs) && slabTiers.length) {
    // Percentage slabs (nsv / phasing / qnsv) — cumulative payout per % boundary.
    if (first && "pct" in first) {
      // stepUpBy1Percent is only meaningful for percentage slabs; it decides how
      // the slab is stored. Default to step-up when the rule predates the flag.
      const stepUp = rd?.stepUpBy1Percent !== false;
      const stepMode = stepUp ? "stepup" : "slab";
      if (!stepUp) {
        // Pure slab: each slab's entryPayout IS the absolute cumulative payout the
        // tier carries (see computeSlabEarnings, mode "slab"). ratePerPct is unused.
        const slabs = slabTiers.map((t) => ({ pct: t.minVal, ratePerPct: 0, entryPayout: t.payout }));
        return withExtras({ ...base, slabs, stepMode });
      }
      const slabs = slabTiers.map((t, i) => {
        if (i === 0) return { pct: t.minVal, ratePerPct: 0, entryPayout: t.payout };
        const prev = slabTiers[i - 1];
        const dPct = t.minVal - prev.minVal;
        return { pct: t.minVal, ratePerPct: dPct ? Math.round((t.payout - prev.payout) / dPct) : 0 };
      });
      // The entry slab's ₹/1% is unused by the payout math and unrecoverable;
      // mirror the next slab's rate so the card shows a sensible value.
      if (slabs.length > 1) slabs[0].ratePerPct = (slabs[1] as { ratePerPct: number }).ratePerPct;
      return withExtras({ ...base, slabs, stepMode });
    }
    // Threshold slabs (collection / new_outlets) — absolute payout at a threshold.
    if (first && "threshold" in first) {
      const slabs = slabTiers.map((t) => ({ threshold: t.minVal, payout: t.payout }));
      return withExtras({ ...base, slabs });
    }
    // Outlet-count slabs (eco) — cumulative per-outlet rate.
    if (first && "count" in first) {
      let prevCum = 0;
      let prevCount = 0;
      const slabs = slabTiers.map((t) => {
        const dCount = t.minVal - prevCount;
        const ratePerOutlet = dCount ? Math.round((t.payout - prevCum) / dCount) : 0;
        prevCum = t.payout;
        prevCount = t.minVal;
        return { count: t.minVal, ratePerOutlet };
      });
      return withExtras({ ...base, slabs });
    }
  }

  // Lines (tlsd / dbb) — min..max lines at a per-line rate; the middle tier holds
  // [minLines, maxLines] → top payout.
  if ("minLines" in base && "maxLines" in base) {
    const mid = tiers[1];
    if (mid) {
      const ratePerLine = mid.maxVal ? Math.round(mid.payout / mid.maxVal) : (base.ratePerLine as number);
      return withExtras({ ...base, minLines: mid.minVal, maxLines: mid.maxVal, ratePerLine });
    }
  }

  return withExtras(base);
}

export function ruleToBuilder(rule: RuleRecord): BuilderState {
  const m = /^(\d{4})-(\d{2})/.exec(rule.effectiveFrom ?? "");
  const year = m ? Number(m[1]) : emptyBuilder.basics.year;
  const month = m ? Number(m[2]) : emptyBuilder.basics.month;
  const period = PERIOD_BY_FREQ[rule.calculationFrequency ?? ""] ?? "monthly";

  const criteria = (rule.applicabilityCriteria ?? {}) as ApplicabilityCriteria;
  const conditions = normalizeConditions(criteria);
  // Role section is populated whenever the rule carries the audience at all —
  // see rolesFromRule (verbatim kpiConfig first, else recovered from criteria).
  const roles = rolesFromRule(rule);
  const channels = channelsFor(conditions);

  // If the engine preserved the verbatim wizard config we round-trip in
  // kpiConfig, use it (lossless). Otherwise everything is recovered from the
  // rule's own API data — no local storage involved.
  const ui = (rule.kpiConfig ?? {}) as {
    templateId?: string;
    templateConfig?: unknown;
    customName?: string;
    scope?: KpiScope;
    groupIds?: string[];
  };

  // Prefer the round-tripped templateId (1:1 with the config); fall back to
  // recovering it from kpiCode / kpiCombination.
  const catalog = getKpiCatalog().entries;
  const templateId: KpiTemplateId =
    ui.templateId && catalog[ui.templateId]
      ? (ui.templateId as KpiTemplateId)
      : resolveTemplateId(rule);
  const tpl = KPI_TEMPLATE_MAP[templateId];

  // Restore the config straight from the API: the verbatim copy if the engine
  // kept it, else rebuilt from the payout tiers it returns. Template defaults
  // apply only when the rule carries no tiers at all.
  const config =
    ui.templateConfig ??
    configFromTiers(tpl, normalizeRuleTiers(rule.ruleDefinition), rule.ruleDefinition);
  const customName = ui.customName;

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
    programKpis: [
      {
        templateId,
        instanceId: uid("kpi"),
        config,
        ...(customName ? { customName } : {}),
        ...(ui.scope ? { scope: ui.scope } : {}),
        ...(ui.groupIds ? { groupIds: ui.groupIds } : {}),
      },
    ],
  };
}
