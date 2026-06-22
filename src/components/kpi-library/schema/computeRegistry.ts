// Named-function registry — the one code-side escape hatch for config-driven
// KPIs. Pure presentation/data points live in config; the math (earning
// ladders, max payout, header value, one-line summary) differs per KPI and is
// referenced from config by `computeId`. Existing math is reused verbatim.

import { computeSlabEarnings, type NsvTemplateConfig } from "../nsvTypes";
import {
  simpleSlabMaxPayout, aiRecoMaxPayout, aiRecoSummary,
  type SimpleSlabConfig, type EcoConfig, type LinesConfig, type AiRecommendedOrderConfig,
} from "../kpiConfigTypes";
import type { ComputeId } from "./kpiSchema";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export interface LadderStep {
  label: string;
  value: number;
}

export interface ComputeFn {
  /** Steps for the earning-ladder preview. */
  ladder(cfg: unknown): LadderStep[];
  /** Max payout for header/totals. null = formula-based (e.g. ASO multiplier). */
  maxPayout(cfg: unknown): number | null;
  /** Header label + value (handles the "Formula" branch for ASO roles). */
  header(cfg: unknown): { label: string; value: string };
  /** One-line descriptor for review/detail views. */
  summarize(cfg: unknown): string;
}

// Eco earning loop — re-implemented here (was module-local in EcoTemplateCard).
function ecoEarnings(slabs: { count: number; ratePerOutlet: number }[]) {
  const out: Array<{ count: number; cumulative: number }> = [];
  let cum = 0;
  for (let i = 0; i < slabs.length; i++) {
    const prevCount = i === 0 ? 0 : slabs[i - 1].count;
    cum += (slabs[i].count - prevCount) * slabs[i].ratePerOutlet;
    out.push({ count: slabs[i].count, cumulative: cum });
  }
  return out;
}

const slabEarnings: ComputeFn = {
  ladder: (c) => {
    const cfg = c as NsvTemplateConfig;
    return computeSlabEarnings(cfg.slabs, cfg.stepMode ?? "stepup").map((e) => ({
      label: `${e.pct}%`,
      value: e.cumulative,
    }));
  },
  maxPayout: (c) => {
    const cfg = c as NsvTemplateConfig;
    const e = slabEarnings.ladder(c);
    const base = e.length ? e[e.length - 1].value : 0;
    // Step-up caps keep earning at the top slab's ₹/1% rate from the top slab up
    // to the cap %, so the max must include that diff band. (Pure-slab mode has no
    // per-1% rate — the payout is fixed per slab — so the cap adds nothing there.)
    const stepUp = (cfg.stepMode ?? "stepup") === "stepup";
    if (stepUp && cfg.cap?.enabled && cfg.slabs?.length) {
      const top = cfg.slabs[cfg.slabs.length - 1];
      const span = (cfg.cap.pct ?? top.pct) - top.pct;
      if (span > 0) return base + Math.round(span * top.ratePerPct);
    }
    return base;
  },
  header: (c) => ({ label: "Max earning", value: fmt(slabEarnings.maxPayout(c) ?? 0) }),
  summarize: (c) => {
    const cfg = c as NsvTemplateConfig & { cutoffDay?: number };
    const max = slabEarnings.maxPayout(c) ?? 0;
    const lead = cfg.cutoffDay != null ? `Cut-off day ${cfg.cutoffDay}` : cfg.basis;
    return `${lead} · ${cfg.slabs.length} slabs · max ${fmt(max)}`;
  },
};

const simpleLadder: ComputeFn = {
  ladder: (c) => {
    const cfg = c as SimpleSlabConfig;
    const prefix = cfg.unit === "amount" ? "₹" : "";
    const suffix = cfg.unit === "pct" ? "%" : "";
    return [...cfg.slabs]
      .sort((a, b) => a.threshold - b.threshold)
      .map((s) => ({ label: `${prefix}${s.threshold}${suffix}`, value: s.payout }));
  },
  maxPayout: (c) => simpleSlabMaxPayout(c as SimpleSlabConfig),
  header: (c) => ({ label: "Max earning", value: fmt(simpleLadder.maxPayout(c) ?? 0) }),
  summarize: (c) => {
    const cfg = c as SimpleSlabConfig;
    return `${cfg.slabs.length} slabs · max ${fmt(simpleLadder.maxPayout(c) ?? 0)}`;
  },
};

const ecoLadder: ComputeFn = {
  ladder: (c) => {
    const cfg = c as EcoConfig;
    return ecoEarnings(cfg.slabs).map((e) => ({ label: `${e.count}`, value: e.cumulative }));
  },
  maxPayout: (c) => {
    const cfg = c as EcoConfig;
    if (cfg.role === "aso_ase") return null;
    const e = ecoEarnings(cfg.slabs);
    const base = e.length ? e[e.length - 1].cumulative : 0;
    // Cap keeps earning at the top band's ₹/outlet rate from the top slab up to the
    // cap outlet count, so the max must include that diff band.
    if (cfg.cap?.enabled && cfg.slabs?.length) {
      const top = cfg.slabs[cfg.slabs.length - 1];
      const span = (cfg.cap.outlets ?? top.count) - top.count;
      if (span > 0) return base + Math.round(span * top.ratePerOutlet);
    }
    return base;
  },
  header: (c) => {
    const cfg = c as EcoConfig;
    if (cfg.role === "aso_ase")
      return { label: "Formula", value: `${cfg.rateMultiplier} × Avg MR earning` };
    return { label: "Max earning", value: fmt(ecoLadder.maxPayout(c) ?? 0) };
  },
  summarize: (c) => {
    const cfg = c as EcoConfig;
    if (cfg.role === "aso_ase") return `ASO/ASE · ${cfg.rateMultiplier} × Avg MR earning`;
    return `MR · min ₹${cfg.minBillAmount} GSV · ${cfg.slabs.length} slabs · max ${fmt(ecoLadder.maxPayout(c) ?? 0)}`;
  },
};

const linesLadder: ComputeFn = {
  ladder: (c) => {
    const cfg = c as LinesConfig;
    const pts = [cfg.minLines, Math.round((cfg.minLines + cfg.maxLines) / 2), cfg.maxLines];
    return pts.map((n) => ({ label: `${n} lines`, value: n * cfg.ratePerLine }));
  },
  maxPayout: (c) => {
    const cfg = c as LinesConfig;
    return cfg.role === "aso_ase" ? null : cfg.maxLines * cfg.ratePerLine;
  },
  header: (c) => {
    const cfg = c as LinesConfig;
    if (cfg.role === "aso_ase")
      return { label: "Formula", value: `${cfg.rateMultiplier} × Avg MR earning` };
    return { label: "Max earning", value: fmt(linesLadder.maxPayout(c) ?? 0) };
  },
  summarize: (c) => {
    const cfg = c as LinesConfig;
    return cfg.role === "mr"
      ? `MR · ${cfg.minLines}–${cfg.maxLines} lines · ${fmt(cfg.maxLines * cfg.ratePerLine)}`
      : `ASO/ASE · ${cfg.rateMultiplier} × Avg MR earning`;
  },
};

const aiReco: ComputeFn = {
  ladder: () => [], // the ai-reco section renders its own sub-editors
  maxPayout: (c) => aiRecoMaxPayout(c as AiRecommendedOrderConfig),
  header: (c) => ({ label: "Max earning", value: fmt(aiRecoMaxPayout(c as AiRecommendedOrderConfig)) }),
  summarize: (c) => aiRecoSummary(c as AiRecommendedOrderConfig),
};

export const COMPUTE_REGISTRY: Record<ComputeId, ComputeFn> = {
  slabEarnings,
  simpleLadder,
  ecoLadder,
  linesLadder,
  aiReco,
};
