// Emami incentive programme domain types.
// Pure data contracts — no runtime logic.

export type Channel = "CCD" | "HCD";

// The four canonical roles are kept as literals for autocomplete, but the role
// is ultimately sourced from config (see fetchProgramRoles / rolesFromRule), so
// any config-defined role string is also valid. The `(string & {})` member
// widens the type to all strings without collapsing the literal hints.
export type RoleType = "MR" | "ASO_ASE" | "ASO" | "ASM" | (string & {});

export type WorkingSegment =
  | "urban-retail"
  | "urban-wholesale"
  | "rural-ss"
  | "hybrid"
  | "urban"
  | "rural"
  | "urban-cities"
  | "other-markets"
  | "all";

export type Geography = "all-india" | "kerala" | "urban-cities" | "other-markets";

export type ProgrammeStatus = "draft" | "active" | "locked" | "archived" | "inactive";

export type DataFeedType = "ai-ml" | "mdm-upload" | "manual" | "proxy";

export type NsvBasis = "primary" | "secondary" | "sub-db-primary";

// ─── KPI slab structures ────────────────────────────────────────────────────

export interface LinearSlab {
  entryAmount: number;
  stepRate: number;
  minPct: number;
  capAmount: number;
}

export interface TieredSlab {
  tiers: Array<{ thresholdPct: number; payout: number; label: string }>;
}

export interface FlatTriggerSlab {
  thresholdPct: number;
  payout: number;
}

export interface PhasingSlabs {
  t55: number;
  t65: number;
  t70: number;
  t75: number;
}

export interface EcoConfig {
  minBillValue: number;
  minOutlets: number;
  maxOutlets: number;
  ratePerOutlet: number;
  maxPayout: number;
}

export interface PerLineSlab {
  minLines: number;
  maxLines: number;
  ratePerLine: number;
  maxPayout: number;
}

export interface ChannelFocusTier {
  channelName: string;
  t90: number;
  t95: number;
  t100: number;
  ecoWeight: number;
  salesWeight: number;
  timing: "monthly" | "may-jun" | "after-jun";
}

// ─── Per-KPI configuration ──────────────────────────────────────────────────

export interface KpiConfig {
  enabled: boolean;
  dataFeed: DataFeedType;
  nsvBasis?: NsvBasis;
  linearSlab?: LinearSlab;
  tieredSlab?: TieredSlab;
  phasingSlab?: PhasingSlabs;
  ecoConfig?: EcoConfig;
  perLineSlab?: PerLineSlab;
  flatTrigger?: FlatTriggerSlab;
  channelFocusTiers?: ChannelFocusTier[];
  budgetedCount?: number;
  urbanHrsThreshold?: number;
  ruralHrsThreshold?: number;
  payoutAmount?: number;
}

// ─── Gate conditions ────────────────────────────────────────────────────────

export interface GateConditions {
  nsvMinPct: number;
  gtCollectionMinPct?: number;
  cftUrbanHrs: number;
  cftRuralHrs: number;
  cftMinWorkingDays: number;
  cftPenaltyPct: number;
  ecoZeroNetValueExcluded: boolean;
  ecoDoubleCountsSameDayBilling: boolean;
  partialMonthProRata: boolean;
}

// ─── Full programme ─────────────────────────────────────────────────────────

/** One KPI of a programme, as recovered from the engine rule that scores it. */
export interface ProgrammeKpiSummary {
  /** Id of the rule this KPI came from. */
  ruleId: string;
  /** KPI template id from the catalog (e.g. "nsv"), when the rule carries it. */
  templateId?: string;
  /** Display name shown in the programme's KPI breakdown. */
  name: string;
  /** This KPI's max payout — the programme's total is the sum across KPIs. */
  maxEarning: number;
}

export interface Programme {
  id: string;
  name: string;
  status: ProgrammeStatus;
  channel: Channel;
  role: RoleType;
  segment: WorkingSegment;
  geography: Geography;
  period: { month: number; year: number; isQ1: boolean };
  /** Groups the rules of one programme; the join key onto
   *  GET /v1/programs/analytics. Absent on rules created before it existed. */
  programId?: string;
  /** Rule window from the engine (ISO `YYYY-MM-DD`). Drives the Active /
   *  Scheduled / Completed categorisation on the campaigns views. */
  effectiveFrom?: string;
  effectiveTill?: string;
  /** Every engine rule backing this programme — the engine stores one rule per
   *  KPI, while the list shows one row per programme. Archiving or updating the
   *  programme has to touch all of them. `id` is the first of these. */
  ruleIds?: string[];
  /** The programme's KPIs, aggregated from those rules. Empty for the demo
   *  programmes, which describe their KPIs through the `kpis` map below. */
  kpiSummaries?: ProgrammeKpiSummary[];
  kpis: {
    A_nsv?: KpiConfig;
    B_phasing?: KpiConfig;
    C_eco?: KpiConfig;
    D_tlsd?: KpiConfig;
    E_dbb?: KpiConfig;
    F_cft?: KpiConfig;
    G_subDbBilling?: KpiConfig;
    H_msb?: KpiConfig;
    I_channelFocus?: KpiConfig;
    J_teamEarning?: KpiConfig;
    K_appUsage?: KpiConfig;
    L_quarterly?: KpiConfig;
  };
  gates: GateConditions;
  maxMonthlyEarning: number;
  createdAt: string;
  updatedAt: string;
}
