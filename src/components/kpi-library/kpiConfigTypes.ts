// KPI config value-object TYPES and pure earning MATH.
//
// Default values no longer live here — they're pure data in
// schema/kpiConfig.dummy.json (and ultimately the config API). This module only
// holds the TypeScript shapes the config value objects take (load-bearing for
// serialization in src/lib/rulePayload.ts) and the math the compute registry
// reuses by `computeId`.

import type { NsvTemplateConfig } from "./nsvTypes";
import type { DbbProductConfig } from "./DbbProductSelector";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ── ECO ──────────────────────────────────────────────────────────────────────
export type EcoRole = "mr" | "aso_ase";
export type MinBillMode =
  | "per_bill" | "cumulative_daily" | "cumulative_weekly"
  | "cumulative_fortnightly" | "cumulative_monthly" | "per_visit" | "any_nonzero";

export interface EcoSlab {
  count: number;
  ratePerOutlet: number;
}
export interface EcoConfig {
  role: EcoRole;
  minBillEnabled: boolean;
  minBillMode: MinBillMode;
  minBillAmount: number;
  slabs: EcoSlab[];
  rateMultiplier: number;
  doubleBillingCountsTwice: boolean;
  cap: { enabled: boolean; outlets: number };
  gatesEnabled: boolean;
  gates: NsvTemplateConfig["gates"];
  keyNotes?: string[];
}

// ── Lines (TLSD / DBB) ───────────────────────────────────────────────────────
export type LineCountingLevel = "sku" | "group";
export type LinesRole = "mr" | "aso_ase";
export type MinQtyUom = "case" | "piece" | "carton" | "kg" | "litre" | "other";

export interface LinesConfig {
  role: LinesRole;
  countingLevel: LineCountingLevel;
  minQtyEnabled: boolean;
  minQtyValue: number;
  minQtyUom: MinQtyUom;
  minQtyUomOther?: string;
  minLines: number;
  maxLines: number;
  ratePerLine: number;
  rateMultiplier: number;
  focusSkuFile?: string;
  dbbProducts?: DbbProductConfig;
  gatesEnabled: boolean;
  gates: NsvTemplateConfig["gates"];
  keyNotes?: string[];
}

// ── Simple-slab KPIs (Collection, PCC, …) ────────────────────────────────────
export type SlabUnit = "pct" | "count" | "amount";

export interface SimpleSlab {
  threshold: number;
  payout: number;
}
export interface SimpleSlabConfig {
  unit: SlabUnit;
  dataFeed: "ai-ml" | "sfa" | "manual" | "upload";
  slabs: SimpleSlab[];
  cap: { enabled: boolean; value: number };
  gatesEnabled: boolean;
  gates: NsvTemplateConfig["gates"];
  keyNotes?: string[];
}

export function simpleSlabMaxPayout(c: SimpleSlabConfig): number {
  if (!c.slabs.length) return 0;
  return [...c.slabs].sort((a, b) => a.threshold - b.threshold).at(-1)!.payout;
}

// ── Phasing / Quarterly NSV (structurally NSV) ───────────────────────────────
export interface PhasingConfig extends NsvTemplateConfig {
  cutoffDay: number;
}
export type QuarterlyNsvConfig = NsvTemplateConfig;

// ── AI Recommended Order ─────────────────────────────────────────────────────
export type AiRecoPayoutBasis = "monthly_pct" | "per_line";
export type AiRecoComplianceType = "sku_only" | "sku_and_qty";

export interface AiRecoSlab {
  threshold: number;
  payout: number;
}
export interface AiRecoPerLineConfig {
  ratePerLine: number;
  minLines: number;
  maxLines: number;
}
export interface AiRecoSubMetricConfig {
  enabled: boolean;
  payoutBasis: AiRecoPayoutBasis;
  complianceType: AiRecoComplianceType;
  slabs: AiRecoSlab[];
  perLine: AiRecoPerLineConfig;
}
export interface AiRecommendedOrderConfig {
  crossSell: AiRecoSubMetricConfig;
  recover: AiRecoSubMetricConfig;
  keyNotes: string[];
}

function subMax(s: AiRecoSubMetricConfig): number {
  if (!s.enabled) return 0;
  if (s.payoutBasis === "per_line") return Math.max(0, s.perLine.maxLines * s.perLine.ratePerLine);
  if (!s.slabs.length) return 0;
  return s.slabs.reduce((m, x) => Math.max(m, x.payout), 0);
}

export function aiRecoMaxPayout(c: AiRecommendedOrderConfig): number {
  return subMax(c.crossSell) + subMax(c.recover);
}

export function aiRecoSummary(c: AiRecommendedOrderConfig): string {
  const parts: string[] = [];
  if (c.crossSell.enabled) parts.push(`Cross-sell ${fmt(subMax(c.crossSell))}`);
  if (c.recover.enabled) parts.push(`Recover ${fmt(subMax(c.recover))}`);
  if (!parts.length) return "No sub-metrics enabled";
  return `${parts.join(" + ")} · max ${fmt(aiRecoMaxPayout(c))}`;
}
