// FMCG KPI template wrappers built on the generic SimpleSlabTemplateCard.
// Each export is a self-contained card with the right defaults, copy, and
// key notes for that KPI. Registered in registry.ts.

import {
  SimpleSlabTemplateCard,
  makeSimpleSlabDefault,
  simpleSlabMaxPayout,
  type SimpleSlabConfig,
} from "./SimpleSlabTemplateCard";

// ─── Collection % of Billing ────────────────────────────────────────────────
export const DEFAULT_COLLECTION: SimpleSlabConfig = makeSimpleSlabDefault(
  "pct",
  [
    { threshold: 85, payout: 800 },
    { threshold: 90, payout: 1600 },
    { threshold: 95, payout: 2800 },
    { threshold: 100, payout: 4000 },
  ],
  {
    dataFeed: "sfa",
    cap: { enabled: true, value: 100 },
    keyNotes: [
      "Collected ₹ in the month ÷ billed ₹ in the same month.",
      "Cheque bounces & reversals deduct from collected amount.",
      "Cash & UPI on the SFA app counts on the date of receipt.",
    ],
  },
);
interface SimpleKpiCardProps {
  value?: SimpleSlabConfig;
  onChange?: (value: SimpleSlabConfig) => void;
  hideRoleSelector?: boolean;
}

export const CollectionTemplateCard = ({ value, onChange, hideRoleSelector }: SimpleKpiCardProps) => (
  <SimpleSlabTemplateCard
    selfId="collection"
    title="Collection % of Billing"
    tag="Collection"
    description="Cash collected vs billed value in the period."
    unitLabel="% achievement"
    defaultConfig={DEFAULT_COLLECTION}
    value={value}
    onChange={onChange}
  />
);

// ─── New Outlets Added ──────────────────────────────────────────────────────
export const DEFAULT_NEW_OUTLETS: SimpleSlabConfig = makeSimpleSlabDefault(
  "count",
  [
    { threshold: 5, payout: 500 },
    { threshold: 10, payout: 1200 },
    { threshold: 15, payout: 2000 },
    { threshold: 20, payout: 3000 },
  ],
  {
    dataFeed: "sfa",
    cap: { enabled: true, value: 25 },
    keyNotes: [
      "New = first-ever billing for an outlet code in the period.",
      "Outlet must have at least one bill ≥ ₹250 GSV to qualify.",
      "Re-activated outlets (>90 days dormant) do not count as new.",
    ],
  },
);
export const NewOutletsTemplateCard = ({ value, onChange }: SimpleKpiCardProps) => (
  <SimpleSlabTemplateCard
    selfId="new_outlets"
    title="New Outlets Added"
    tag="Coverage"
    description="Brand-new outlets billed for the first time in the period."
    unitLabel="outlets"
    defaultConfig={DEFAULT_NEW_OUTLETS}
    value={value}
    onChange={onChange}
  />
);

// ─── Range Selling % ────────────────────────────────────────────────────────
export const DEFAULT_RANGE_SELLING: SimpleSlabConfig = makeSimpleSlabDefault(
  "pct",
  [
    { threshold: 40, payout: 600 },
    { threshold: 55, payout: 1400 },
    { threshold: 70, payout: 2400 },
    { threshold: 85, payout: 3600 },
  ],
  {
    dataFeed: "sfa",
    cap: { enabled: true, value: 100 },
    keyNotes: [
      "% of billed outlets selling ≥ N categories (default N = 3).",
      "Measures portfolio width, not just volume.",
      "Configure focus categories at the programme level.",
    ],
  },
);
export const RangeSellingTemplateCard = ({ value, onChange }: SimpleKpiCardProps) => (
  <SimpleSlabTemplateCard
    selfId="range_selling"
    title="Range Selling %"
    tag="Distribution"
    description="Share of outlets billed across multiple focus categories."
    unitLabel="% achievement"
    defaultConfig={DEFAULT_RANGE_SELLING}
    value={value}
    onChange={onChange}
  />
);

// ─── PCC — Productive Calls per Day ─────────────────────────────────────────
export const DEFAULT_PCC: SimpleSlabConfig = makeSimpleSlabDefault(
  "count",
  [
    { threshold: 18, payout: 400 },
    { threshold: 22, payout: 1000 },
    { threshold: 26, payout: 1800 },
    { threshold: 30, payout: 2800 },
  ],
  {
    dataFeed: "sfa",
    cap: { enabled: true, value: 35 },
    keyNotes: [
      "Avg productive calls = billed visits ÷ field working days.",
      "Excludes Sundays and approved leave days.",
      "A visit is productive only if it converts to a bill.",
    ],
  },
);
export const PccTemplateCard = ({ value, onChange }: SimpleKpiCardProps) => (
  <SimpleSlabTemplateCard
    selfId="pcc"
    title="PCC — Productive Calls per Day"
    tag="Productivity"
    description="Average productive (billed) calls per field working day."
    unitLabel="calls / day"
    defaultConfig={DEFAULT_PCC}
    value={value}
    onChange={onChange}
  />
);

// ─── Beat Plan / Call Compliance % ──────────────────────────────────────────
export const DEFAULT_CALL_COMPLIANCE: SimpleSlabConfig = makeSimpleSlabDefault(
  "pct",
  [
    { threshold: 80, payout: 500 },
    { threshold: 90, payout: 1200 },
    { threshold: 95, payout: 2000 },
  ],
  {
    dataFeed: "sfa",
    cap: { enabled: true, value: 100 },
    keyNotes: [
      "Actual visited outlets ÷ planned beat outlets.",
      "Off-route visits do not count toward compliance.",
      "GPS-tagged within 100m of outlet location to qualify.",
    ],
  },
);
export const CallComplianceTemplateCard = ({ value, onChange }: SimpleKpiCardProps) => (
  <SimpleSlabTemplateCard
    selfId="call_compliance"
    title="Beat Plan / Call Compliance %"
    tag="Productivity"
    description="Adherence to the planned daily beat / PJP."
    unitLabel="% achievement"
    defaultConfig={DEFAULT_CALL_COMPLIANCE}
    value={value}
    onChange={onChange}
  />
);

// ─── Must-Sell SKU Achievement ──────────────────────────────────────────────
export const DEFAULT_MUST_SELL_SKU: SimpleSlabConfig = makeSimpleSlabDefault(
  "pct",
  [
    { threshold: 70, payout: 700 },
    { threshold: 85, payout: 1700 },
    { threshold: 100, payout: 3000 },
  ],
  {
    dataFeed: "sfa",
    cap: { enabled: true, value: 110 },
    keyNotes: [
      "Achievement on the mandatory must-sell SKU basket vs target.",
      "Configure the must-sell list per channel / segment.",
      "Different from focus / NPD SKUs — these are everyday hero SKUs.",
    ],
  },
);
export const MustSellSkuTemplateCard = ({ value, onChange }: SimpleKpiCardProps) => (
  <SimpleSlabTemplateCard
    selfId="must_sell_sku"
    title="Must-Sell SKU Achievement"
    tag="Sales Volume"
    description="Achievement on the mandatory must-sell SKU list."
    unitLabel="% achievement"
    defaultConfig={DEFAULT_MUST_SELL_SKU}
    value={value}
    onChange={onChange}
  />
);

// ─── ULPO — Unique Lines per Outlet ─────────────────────────────────────────
export const DEFAULT_ULPO: SimpleSlabConfig = makeSimpleSlabDefault(
  "count",
  [
    { threshold: 3, payout: 600 },
    { threshold: 5, payout: 1500 },
    { threshold: 7, payout: 2600 },
  ],
  {
    dataFeed: "sfa",
    cap: { enabled: true, value: 10 },
    keyNotes: [
      "Avg unique lines billed per billed outlet in the period.",
      "Counted at CRS group code level.",
      "Drives depth of sell-in per outlet, complements TLSD.",
    ],
  },
);
export const UlpoTemplateCard = ({ value, onChange }: SimpleKpiCardProps) => (
  <SimpleSlabTemplateCard
    selfId="ulpo"
    title="ULPO — Unique Lines per Outlet"
    tag="Distribution"
    description="Average unique lines billed per outlet."
    unitLabel="lines / outlet"
    defaultConfig={DEFAULT_ULPO}
    value={value}
    onChange={onChange}
  />
);

// Re-export helper for the registry max-payout lookup.
export const maxPayoutOf = simpleSlabMaxPayout;
