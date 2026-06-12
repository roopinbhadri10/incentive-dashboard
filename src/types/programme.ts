// Emami incentive programme domain types.
// Pure data contracts — no runtime logic.

export type Channel = "CCD" | "HCD";

export type RoleType = "MR" | "ASO_ASE" | "ASO" | "ASM";

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

export type ProgrammeStatus = "draft" | "active" | "locked" | "archived";

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

export interface Programme {
  id: string;
  name: string;
  status: ProgrammeStatus;
  channel: Channel;
  role: RoleType;
  segment: WorkingSegment;
  geography: Geography;
  period: { month: number; year: number; isQ1: boolean };
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
