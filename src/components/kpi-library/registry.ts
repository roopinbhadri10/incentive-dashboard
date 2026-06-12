import type { ComponentType } from "react";
import { NsvTemplateCard } from "./NsvTemplateCard";
import { PhasingTemplateCard, DEFAULT_PHASING, type PhasingConfig } from "./PhasingTemplateCard";
import { EcoTemplateCard, DEFAULT_ECO, type EcoConfig } from "./EcoTemplateCard";
import {
  TlsdTemplateCard,
  DbbTemplateCard,
  defaultLinesConfig,
  TLSD_DEFAULTS,
  DBB_DEFAULTS,
  TLSD_KEY_NOTES,
  DBB_KEY_NOTES,
  type LinesConfig,
} from "./LinesTemplateCard";
import {
  QuarterlyNsvTemplateCard,
  DEFAULT_QNSV,
  type QuarterlyNsvConfig,
} from "./QuarterlyNsvTemplateCard";
import {
  DEFAULT_NSV,
  computeSlabEarnings,
  type NsvTemplateConfig,
} from "./nsvTypes";
import {
  CollectionTemplateCard,
  NewOutletsTemplateCard,
  RangeSellingTemplateCard,
  PccTemplateCard,
  CallComplianceTemplateCard,
  MustSellSkuTemplateCard,
  UlpoTemplateCard,
  DEFAULT_COLLECTION,
  DEFAULT_NEW_OUTLETS,
  DEFAULT_RANGE_SELLING,
  DEFAULT_PCC,
  DEFAULT_CALL_COMPLIANCE,
  DEFAULT_MUST_SELL_SKU,
  DEFAULT_ULPO,
  maxPayoutOf,
} from "./FmcgKpiTemplates";
import type { SimpleSlabConfig } from "./SimpleSlabTemplateCard";
import {
  AiRecommendedOrderTemplateCard,
  DEFAULT_AI_RECO,
  aiRecoMaxPayout,
  aiRecoSummary,
  type AiRecommendedOrderConfig,
} from "./AiRecommendedOrderTemplateCard";

export type KpiTemplateId =
  | "nsv"
  | "phasing"
  | "eco"
  | "tlsd"
  | "dbb"
  | "qnsv"
  | "collection"
  | "new_outlets"
  | "range_selling"
  | "pcc"
  | "call_compliance"
  | "must_sell_sku"
  | "ulpo"
  | "ai_recommended_order";

interface TemplateEntry {
  id: KpiTemplateId;
  name: string;
  tag: string;
  description: string;
  sample: string;
  Component: ComponentType<{ value?: unknown; onChange?: (v: unknown) => void; lockedRole?: "mr" | "aso"; hideRoleSelector?: boolean }>;
  defaultConfig: () => unknown;
  summarize: (cfg: unknown) => string;
  maxPayout: (cfg: unknown) => number | null;
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const nsvMax = (c: NsvTemplateConfig) => {
  const e = computeSlabEarnings(c.slabs, c.stepMode ?? "stepup");
  return e.length ? e[e.length - 1].cumulative : 0;
};

export const KPI_TEMPLATES: TemplateEntry[] = [
  {
    id: "ai_recommended_order",
    name: "AI Recommended Order",
    tag: "AI Recommendations",
    description:
      "Rewards reps for fulfilling the SFA one-click order (Cross-sell + Recover SKU).",
    sample: "Cross-sell + Recover · % accepted · up to ₹4,000",
    Component: AiRecommendedOrderTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_AI_RECO),
    summarize: (c: AiRecommendedOrderConfig) => aiRecoSummary(c),
    maxPayout: (c: AiRecommendedOrderConfig) => aiRecoMaxPayout(c),
  },
  {
    id: "nsv",
    name: "Net Sales Value",
    tag: "Sales Volume",
    description: "Monthly net sales vs target.",
    sample: "Slabs 95% → 110% · ₹2,400 → ₹6,000",
    Component: NsvTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_NSV),
    summarize: (c: NsvTemplateConfig) =>
      `${c.basis} · ${c.slabs.length} slabs · max ${fmt(nsvMax(c))}`,
    maxPayout: (c: NsvTemplateConfig) => nsvMax(c),
  },
  {
    id: "phasing",
    name: "Sales Phasing",
    tag: "In-Month Pacing",
    description: "Achieve % of month target by a cut-off date.",
    sample: "By day 20 · 55% → 75% · ₹450 → ₹1,330",
    Component: PhasingTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_PHASING),
    summarize: (c: PhasingConfig) =>
      `Cut-off day ${c.cutoffDay} · ${c.slabs.length} slabs · max ${fmt(nsvMax(c))}`,
    maxPayout: (c: PhasingConfig) => nsvMax(c),
  },
  {
    id: "eco",
    name: "Productive Coverage",
    tag: "Coverage",
    description: "Outlets billed at or above a minimum bill value.",
    sample: "Min ₹250 GSV/bill · 150 → 250 outlets",
    Component: EcoTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_ECO),
    summarize: (c: EcoConfig) => {
      if (c.role === "aso_ase") return `ASO/ASE · ${c.rateMultiplier} × Avg MR earning`;
      const out: Array<{ count: number; delta: number; cumulative: number }> = [];
      let cum = 0;
      for (let i = 0; i < c.slabs.length; i++) {
        const prevCount = i === 0 ? 0 : c.slabs[i - 1].count;
        const d = (c.slabs[i].count - prevCount) * c.slabs[i].ratePerOutlet;
        cum += d;
        out.push({ count: c.slabs[i].count, delta: d, cumulative: cum });
      }
      return `MR · min ₹${c.minBillAmount} GSV · ${c.slabs.length} slabs · max ${fmt(out.at(-1)?.cumulative ?? 0)}`;
    },
    maxPayout: (c: EcoConfig) => {
      if (c.role === "aso_ase") return null;
      let cum = 0;
      for (let i = 0; i < c.slabs.length; i++) {
        const prevCount = i === 0 ? 0 : c.slabs[i - 1].count;
        cum += (c.slabs[i].count - prevCount) * c.slabs[i].ratePerOutlet;
      }
      return cum;
    },
  },
  {
    id: "tlsd",
    name: "Lines Sold",
    tag: "Distribution",
    description: "Unique product lines billed per outlet.",
    sample: "Min 750 · Max 2,500 · ₹1/line",
    Component: TlsdTemplateCard,
    defaultConfig: () => defaultLinesConfig(TLSD_DEFAULTS, TLSD_KEY_NOTES),
    summarize: (c: LinesConfig) =>
      c.role === "mr"
        ? `MR · ${c.minLines}–${c.maxLines} lines · ${fmt(c.maxLines * c.ratePerLine)}`
        : `ASO/ASE · ${c.rateMultiplier} × Avg MR earning`,
    maxPayout: (c: LinesConfig) => (c.role === "mr" ? c.maxLines * c.ratePerLine : null),
  },
  {
    id: "dbb",
    name: "Focus SKU Distribution",
    tag: "Distribution",
    description: "Lines billed from the focus / must-sell SKU list.",
    sample: "Min 200 · Max 800 · ₹3/line · Focus SKU list",
    Component: DbbTemplateCard,
    defaultConfig: () => defaultLinesConfig(DBB_DEFAULTS, DBB_KEY_NOTES),
    summarize: (c: LinesConfig) =>
      c.role === "mr"
        ? `MR · ${c.minLines}–${c.maxLines} lines · ${fmt(c.maxLines * c.ratePerLine)}`
        : `ASO/ASE · ${c.rateMultiplier} × Avg MR earning`,
    maxPayout: (c: LinesConfig) => (c.role === "mr" ? c.maxLines * c.ratePerLine : null),
  },
  {
    id: "qnsv",
    name: "Quarterly NSV Bonus",
    tag: "Sales Volume",
    description: "Separate quarterly slab on top of monthly NSV.",
    sample: "MR ₹6,000 · ASO GT + Region up to ₹21,600",
    Component: QuarterlyNsvTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_QNSV),
    summarize: (c: QuarterlyNsvConfig) =>
      `${c.basis} · ${c.slabs.length} slabs · max ${fmt(nsvMax(c))}`,
    maxPayout: (c: QuarterlyNsvConfig) => nsvMax(c),
  },
  {
    id: "collection",
    name: "Collection % of Billing",
    tag: "Collection",
    description: "Cash collected vs billed value in the period.",
    sample: "85% → 100% · 4 slabs · up to ₹4,000",
    Component: CollectionTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_COLLECTION),
    summarize: (c: SimpleSlabConfig) => `${c.slabs.length} slabs · max ${fmt(maxPayoutOf(c))}`,
    maxPayout: (c: SimpleSlabConfig) => maxPayoutOf(c),
  },
  {
    id: "new_outlets",
    name: "New Outlets Added",
    tag: "Coverage",
    description: "Brand-new outlets billed for the first time in the period.",
    sample: "5 → 20 outlets · up to ₹3,000",
    Component: NewOutletsTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_NEW_OUTLETS),
    summarize: (c: SimpleSlabConfig) => `${c.slabs.length} slabs · max ${fmt(maxPayoutOf(c))}`,
    maxPayout: (c: SimpleSlabConfig) => maxPayoutOf(c),
  },
  {
    id: "range_selling",
    name: "Range Selling %",
    tag: "Distribution",
    description: "Share of outlets billed across multiple focus categories.",
    sample: "40% → 85% · up to ₹3,600",
    Component: RangeSellingTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_RANGE_SELLING),
    summarize: (c: SimpleSlabConfig) => `${c.slabs.length} slabs · max ${fmt(maxPayoutOf(c))}`,
    maxPayout: (c: SimpleSlabConfig) => maxPayoutOf(c),
  },
  {
    id: "pcc",
    name: "PCC — Productive Calls / Day",
    tag: "Productivity",
    description: "Average productive (billed) calls per field working day.",
    sample: "18 → 30 calls/day · up to ₹2,800",
    Component: PccTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_PCC),
    summarize: (c: SimpleSlabConfig) => `${c.slabs.length} slabs · max ${fmt(maxPayoutOf(c))}`,
    maxPayout: (c: SimpleSlabConfig) => maxPayoutOf(c),
  },
  {
    id: "call_compliance",
    name: "Beat / Call Compliance %",
    tag: "Productivity",
    description: "Adherence to the planned daily beat / PJP.",
    sample: "80% → 95% · up to ₹2,000",
    Component: CallComplianceTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_CALL_COMPLIANCE),
    summarize: (c: SimpleSlabConfig) => `${c.slabs.length} slabs · max ${fmt(maxPayoutOf(c))}`,
    maxPayout: (c: SimpleSlabConfig) => maxPayoutOf(c),
  },
  {
    id: "must_sell_sku",
    name: "Must-Sell SKU Achievement",
    tag: "Sales Volume",
    description: "Achievement on the mandatory must-sell SKU list.",
    sample: "70% → 100% · up to ₹3,000",
    Component: MustSellSkuTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_MUST_SELL_SKU),
    summarize: (c: SimpleSlabConfig) => `${c.slabs.length} slabs · max ${fmt(maxPayoutOf(c))}`,
    maxPayout: (c: SimpleSlabConfig) => maxPayoutOf(c),
  },
  {
    id: "ulpo",
    name: "ULPO — Unique Lines per Outlet",
    tag: "Distribution",
    description: "Average unique lines billed per outlet.",
    sample: "3 → 7 lines · up to ₹2,600",
    Component: UlpoTemplateCard,
    defaultConfig: () => structuredClone(DEFAULT_ULPO),
    summarize: (c: SimpleSlabConfig) => `${c.slabs.length} slabs · max ${fmt(maxPayoutOf(c))}`,
    maxPayout: (c: SimpleSlabConfig) => maxPayoutOf(c),
  },
];

/** Convenience: pick the display name for a KPI instance, falling back to the template name. */
export function kpiDisplayName(
  templateId: KpiTemplateId,
  customName?: string | null,
): string {
  const t = KPI_TEMPLATE_MAP[templateId];
  const trimmed = (customName ?? "").trim();
  return trimmed || t.name;
}

export const KPI_TEMPLATE_MAP: Record<KpiTemplateId, TemplateEntry> = Object.fromEntries(
  KPI_TEMPLATES.map((t) => [t.id, t]),
) as Record<KpiTemplateId, TemplateEntry>;
