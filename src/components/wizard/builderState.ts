// Generic FMCG incentive programme builder — state types & defaults.
// No company-specific logic.

export type CalendarBasis =
  | { kind: "standard" }
  | { kind: "fiscal"; startMonth: number }
  | { kind: "company"; fileName?: string };

export type ProgrammePeriod =
  | "monthly"
  | "quarterly"
  | "monthly-plus-quarterly"
  | "half-yearly"
  | "annual"
  | "custom";
export type AttainmentBasis = "order" | "invoice" | "delivery" | "payment";
export type PayoutFrequency = "monthly" | "quarterly" | "on-completion";

export interface BasicsState {
  name: string;
  calendar: CalendarBasis;
  period: ProgrammePeriod;
  customStart?: string;
  customEnd?: string;
  attainmentBasis: AttainmentBasis;
  currency: string;
  payoutFrequency: PayoutFrequency;
  // Programme month (1-12) and year — drives the quarter label.
  month: number;
  year: number;
}

export type Channel = "CCD" | "HCD";

export interface AudienceV2State {
  /** Division — "CCD" | "HCD" (the "Select Division" field). */
  division?: Channel;
  roles: string[];
  geographies: string[]; // tags like "All regions" or "Zone: West" / "State: Maharashtra"
  geographyExceptions: string[]; // tags excluded from selected geographies
  userListBatchIds?: string[]; // selected user-list batch ids from Users List page
}

// ─── KPI builder ──────────────────────────────────────────────────────────
export type DataSourceKind =
  | { kind: "auto" }
  | { kind: "upload" }
  | { kind: "manual" }
  | { kind: "derived"; fromKpiId?: string; multiplier: number };

export type TargetSourceKind =
  | { kind: "system" }
  | { kind: "upload" }
  | { kind: "manual" }
  | { kind: "fixed"; value: number };

export type SlabType =
  | "linear"
  | "tiered"
  | "per-unit"
  | "flat"
  | "percent-base"
  | "formula";

export interface LinearSlabCfg {
  entryPct: number;
  entryPayout: number;
  stepRate: number; // ₹ per 1%
  cap: number;
}
export interface TieredSlabCfg {
  rows: Array<{ pct: number; payout: number }>;
}
export interface PerUnitSlabCfg {
  unitLabel: string;
  minCount: number;
  maxCount: number;
  ratePerUnit: number;
  cap: number;
}
export interface FlatSlabCfg {
  threshold: number;
  thresholdType: "percent" | "count" | "amount";
  payout: number;
}
export interface PercentBaseCfg {
  base: "salary" | "fixed" | "custom";
  customLabel?: string;
  percent: number;
}
export interface FormulaCfg {
  formula: string;
}

export type KpiCategory =
  | "sales-volume"
  | "coverage"
  | "distribution"
  | "activity"
  | "collection"
  | "quality"
  | "team"
  | "strategic"
  | "custom";

export interface KpiItem {
  id: string;
  internalName: string;
  displayName: string;
  description: string;
  category: KpiCategory;
  dataSource: DataSourceKind;
  targetSource: TargetSourceKind;
  slabType: SlabType;
  linear: LinearSlabCfg;
  tiered: TieredSlabCfg;
  perUnit: PerUnitSlabCfg;
  flat: FlatSlabCfg;
  percentBase: PercentBaseCfg;
  formula: FormulaCfg;
}

// ─── Gate rules ───────────────────────────────────────────────────────────
export type GateOperator = "lt" | "gt" | "eq" | "between";
export interface GateCondition {
  metricGroup: "kpi" | "attendance" | "collection" | "activity" | "custom";
  metric: string; // KPI id or metric name
  operator: GateOperator;
  value: number;
  value2?: number; // for "between"
  unit: string;
}
export type GateConsequence =
  | { kind: "zero-all" }
  | { kind: "zero-kpis"; kpiIds: string[] }
  | { kind: "reduce"; percent: number; scope: "all" | string }
  | { kind: "custom"; text: string };

export interface GateRule {
  id: string;
  conditions: GateCondition[];
  joiner: "AND" | "OR";
  consequence: GateConsequence;
}

// ─── Top-level wizard state ───────────────────────────────────────────────

export interface KpiGroup {
  id: string;
  name: string;
  description?: string;
  combinedMaxPayout?: number;
  groupGateNote?: string;
}

export interface KpiScope {
  /** Channels this KPI is scoped to. Empty/undefined = all channels. */
  channels?: string[];
}

export interface ProgramKpi {
  templateId: import("@/components/kpi-library/registry").KpiTemplateId;
  instanceId: string;
  config: unknown;
  /** Optional company-specific KPI label. Falls back to the template name when blank. */
  customName?: string;
  /** Optional groups this KPI belongs to. A KPI can belong to multiple groups. */
  groupIds?: string[];
  /** Optional scope (channel filter). */
  scope?: KpiScope;
}

export interface BuilderState {
  basics: BasicsState;
  audience: AudienceV2State;
  kpis: KpiItem[]; // legacy — kept so existing generic builder still compiles
  programKpis: ProgramKpi[];
  kpiGroups: KpiGroup[];
  /** Programme-level channel vocabulary (free-form tags). */
  channels: string[];
  gates: GateRule[];
}

/**
 * Seed data handed to the wizard when it is opened from a clone/template/saved
 * flow. The known fields below drive the wizard's start step and banner; the
 * index signature carries the extra fields spread in from a Programme or a
 * template's prefilled config.
 */
export interface WizardPrefill {
  type?: "clone" | "template" | "clone-saved";
  name?: string;
  builder?: BuilderState;
  startAtReview?: boolean;
  /** Set on an edit flow: the id of the rule being edited. Present → publishing
   *  PUTs that rule in place; absent → publishing POSTs a new rule. */
  editRuleId?: string;
  [key: string]: unknown;
}

const _now = new Date();
export const emptyBasics: BasicsState = {
  name: "",
  calendar: { kind: "standard" },
  period: "monthly",
  attainmentBasis: "invoice",
  currency: "INR",
  payoutFrequency: "monthly",
  month: _now.getMonth() + 1,
  year: _now.getFullYear(),
};

export const emptyAudience: AudienceV2State = {
  division: undefined,
  roles: [],
  geographies: [],
  geographyExceptions: [],
  userListBatchIds: [],
};

export const emptyBuilder: BuilderState = {
  basics: emptyBasics,
  audience: emptyAudience,
  kpis: [],
  programKpis: [],
  kpiGroups: [],
  // Populated from SalesHub /outlets/stats; stays empty if that call fails.
  channels: [],
  gates: [],
};

// ─── Roles ─────────────────────────────────────────────────────────────────
// Roles are loaded from the /ui-configs endpoint (domainType
// "role_configuration") via fetchProgramRoles() — no hardcoded list.

export function isManagerRole(role: string) {
  return role.startsWith("ASO");
}

export const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

// ─── Defaults for new KPIs ────────────────────────────────────────────────
export function defaultKpi(partial: Partial<KpiItem> = {}): KpiItem {
  return {
    id: uid("kpi"),
    internalName: partial.internalName || "New KPI",
    displayName: partial.displayName || partial.internalName || "New KPI",
    description: partial.description || "",
    category: partial.category || "custom",
    dataSource: { kind: "auto" },
    targetSource: { kind: "system" },
    slabType: "linear",
    linear: { entryPct: 80, entryPayout: 1000, stepRate: 100, cap: 5000 },
    tiered: { rows: [{ pct: 90, payout: 1000 }, { pct: 100, payout: 2000 }] },
    perUnit: { unitLabel: "outlets", minCount: 0, maxCount: 100, ratePerUnit: 50, cap: 5000 },
    flat: { threshold: 100, thresholdType: "percent", payout: 1500 },
    percentBase: { base: "salary", percent: 5 },
    formula: { formula: "Achievement × Rate" },
    ...partial,
  };
}

// ─── KPI library templates ────────────────────────────────────────────────
export const KPI_LIBRARY: Record<KpiCategory, Array<{ name: string; description: string }>> = {
  "sales-volume": [
    { name: "NSV Achievement", description: "Net sales value vs target" },
    { name: "Volume Target", description: "Cases or units sold vs target" },
    { name: "Phasing Achievement", description: "Linear monthly sales pacing" },
  ],
  coverage: [
    { name: "Outlet Coverage", description: "Unique outlets billed in period" },
    { name: "Beat Adherence", description: "Planned vs actual route coverage" },
  ],
  distribution: [
    { name: "ECO — Effective Coverage Outlets", description: "Outlets meeting min bill value" },
    { name: "Numeric Distribution", description: "% of universe selling brand" },
    { name: "TLSD — Top Lines Selling Distribution", description: "Lines per outlet" },
  ],
  activity: [
    { name: "Productive Calls", description: "Calls converting to orders" },
    { name: "App Usage", description: "Days logged in to sales app" },
  ],
  collection: [
    { name: "Collection %", description: "Collected vs billed in period" },
    { name: "Overdue Reduction", description: "Reduction in overdue balance" },
  ],
  quality: [
    { name: "Returns %", description: "Inverse — lower returns earns more" },
    { name: "Compliance Score", description: "Audit & compliance KPI" },
  ],
  team: [
    { name: "Team Earning Multiplier", description: "Bonus when team hits target" },
  ],
  strategic: [
    { name: "Channel Focus", description: "Performance on focus channel" },
    { name: "New Product Push", description: "Sales of new launches" },
  ],
  custom: [],
};

export const CATEGORY_LABELS: Record<KpiCategory, string> = {
  "sales-volume": "Sales Volume",
  coverage: "Coverage",
  distribution: "Distribution",
  activity: "Activity",
  collection: "Collection",
  quality: "Quality",
  team: "Team",
  strategic: "Strategic",
  custom: "Custom",
};

// ─── Suggested roles ──────────────────────────────────────────────────────
export const SUGGESTED_ROLES = [
  "Market Reporter",
  "Area Sales Officer",
  "Area Sales Manager",
  "Territory Manager",
  "Business Development Executive",
];

// ─── Payout calculation (for previews & simulator) ────────────────────────
export function payoutAt(kpi: KpiItem, achievementPct: number): number {
  switch (kpi.slabType) {
    case "linear": {
      const { entryPct, entryPayout, stepRate, cap } = kpi.linear;
      if (achievementPct < entryPct) return 0;
      const raw = entryPayout + (achievementPct - entryPct) * stepRate;
      return Math.min(raw, cap);
    }
    case "tiered": {
      const sorted = [...kpi.tiered.rows].sort((a, b) => a.pct - b.pct);
      let p = 0;
      for (const r of sorted) if (achievementPct >= r.pct) p = r.payout;
      return p;
    }
    case "per-unit": {
      const { minCount, maxCount, ratePerUnit, cap } = kpi.perUnit;
      // Treat achievementPct as % of maxCount for preview purposes.
      const count = Math.round((achievementPct / 100) * maxCount);
      if (count < minCount) return 0;
      return Math.min(count * ratePerUnit, cap);
    }
    case "flat": {
      if (kpi.flat.thresholdType === "percent") {
        return achievementPct >= kpi.flat.threshold ? kpi.flat.payout : 0;
      }
      return 0;
    }
    case "percent-base":
      return Math.round((kpi.percentBase.percent / 100) * 30000); // base assumed 30k for preview
    case "formula":
      return 0;
  }
}

export function maxPayout(kpi: KpiItem): number {
  switch (kpi.slabType) {
    case "linear":
      return kpi.linear.cap;
    case "tiered":
      return kpi.tiered.rows.reduce((m, r) => Math.max(m, r.payout), 0);
    case "per-unit":
      return kpi.perUnit.cap;
    case "flat":
      return kpi.flat.payout;
    case "percent-base":
      return Math.round((kpi.percentBase.percent / 100) * 30000);
    case "formula":
      return 0;
  }
}
