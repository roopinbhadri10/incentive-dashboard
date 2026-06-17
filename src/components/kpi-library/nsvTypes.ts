// Shared types for KPI library templates.
// Currency is locked to ₹ across all KPIs.

export type NsvBasis = "primary" | "secondary";

export interface NsvSlab {
  // Achievement % boundary (e.g. 95, 100, 105, 110)
  pct: number;
  // ₹ rate per 1% applied from the PREVIOUS slab up to (and including) this slab.
  ratePerPct: number;
  // Only used on the FIRST slab — the starting earning amount at the entry %.
  // Subsequent slabs are computed as cumulative + (Δpct × ratePerPct).
  entryPayout?: number;
}

export interface CapConfig {
  enabled: boolean;
  pct: number; // % at which cap applies
}

export type GateConsequence =
  | { kind: "zero" }
  | { kind: "limit"; pct: number }; // limit earnings to X% of full payout

export type GateThresholdUnit = "pct" | "amount" | "count";

export interface GateCondition {
  id: string;
  dependsOnKpiId: string; // KPI B id
  thresholdValue: number;
  thresholdUnit: GateThresholdUnit;
  consequence: GateConsequence;
  // Only relevant when dependsOnKpiId === "collection".
  // Collection % of Billing can be measured against either GSV or NSV.
  collectionBasis?: "gsv" | "nsv";
}

export type SecondaryTargetSource = "upload" | "aiml";
export type TargetStatus = "sfa" | "uploaded" | "later";
export type StepMode = "stepup" | "slab";

export interface NsvTemplateConfig {
  basis: NsvBasis;
  secondarySource?: SecondaryTargetSource; // only when basis === "secondary"
  targetFileName?: string; // remembered uploaded filename
  targetStatus?: TargetStatus; // sfa | uploaded | later (only relevant when upload is required)
  stepMode?: StepMode; // "stepup" (₹/1%) or "slab" (fixed payout per slab). Default: "stepup".
  slabs: NsvSlab[]; // sorted ascending by pct
  cap: CapConfig;
  gatesEnabled: boolean;
  gates: GateCondition[];
  keyNotes?: string[];
}

export const DEFAULT_NSV_KEY_NOTES = [
  "Earned on monthly Net Sales Value vs target.",
  "Slab-based payout — higher achievement, higher rate.",
  "Cap applies above the top slab.",
];

export const DEFAULT_NSV: NsvTemplateConfig = {
  basis: "primary",
  slabs: [
    { pct: 95, ratePerPct: 320, entryPayout: 2400 },
    { pct: 100, ratePerPct: 320 },
    { pct: 105, ratePerPct: 200 },
    { pct: 110, ratePerPct: 200 },
  ],
  cap: { enabled: true, pct: 110 },
  gatesEnabled: false,
  gates: [],
  keyNotes: [...DEFAULT_NSV_KEY_NOTES],
};

// Earnings at end of each slab.
// Slab[0] earning = (pct[0] - 0)*rate? No — entry slab is the floor; earnings start at the entry.
// We treat slab[0] as the trigger (no payout below it). Earnings between slab[i-1] and slab[i]
// = (slab[i].pct - slab[i-1].pct) * slab[i].ratePerPct.
// Cumulative earning at slab[i] = sum of above up to i.
export function computeSlabEarnings(
  slabs: NsvSlab[],
  mode: StepMode = "stepup",
): Array<{ pct: number; delta: number; cumulative: number }> {
  const out: Array<{ pct: number; delta: number; cumulative: number }> = [];
  if (mode === "slab") {
    // Pure slab: each slab's entryPayout is the absolute cumulative earning at that pct.
    let prev = 0;
    for (let i = 0; i < slabs.length; i++) {
      const cumulative = slabs[i].entryPayout ?? 0;
      const delta = i === 0 ? cumulative : cumulative - prev;
      out.push({ pct: slabs[i].pct, delta, cumulative });
      prev = cumulative;
    }
    return out;
  }
  let cum = 0;
  for (let i = 0; i < slabs.length; i++) {
    const delta =
      i === 0
        ? slabs[i].entryPayout ?? 0
        : (slabs[i].pct - slabs[i - 1].pct) * slabs[i].ratePerPct;
    cum += delta;
    out.push({ pct: slabs[i].pct, delta, cumulative: cum });
  }
  return out;
}

export interface NsvValidation {
  duplicateSlabPcts: number[];
  unsortedSlabs: boolean;
  capBelowTopSlab: boolean;
}

export function validateNsv(cfg: NsvTemplateConfig): NsvValidation {
  const seen = new Map<number, number>();
  cfg.slabs.forEach((s) => seen.set(s.pct, (seen.get(s.pct) ?? 0) + 1));
  const duplicateSlabPcts = [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p);
  const pcts = cfg.slabs.map((s) => s.pct);
  const unsortedSlabs = pcts.some((p, i) => i > 0 && p <= pcts[i - 1]);
  const top = pcts[pcts.length - 1] ?? 0;
  const capBelowTopSlab = cfg.cap.enabled && cfg.cap.pct < top;
  return { duplicateSlabPcts, unsortedSlabs, capBelowTopSlab };
}

export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;
