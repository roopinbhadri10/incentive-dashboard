// Mock data layer for Payout Management. Frontend-only — no backend calls.

export type RunStatus =
  | "Draft"
  | "Calculated"
  | "Awaiting Sales Ops"
  | "Awaiting Finance"
  | "Approved"
  | "Processing"
  | "Paid"
  | "Partially failed"
  | "Closed";

export type PayoutMethod = "Bank" | "Amazon" | "Voucher" | "Wallet";

export interface KpiBreakdown {
  kpi: string;
  target: number;
  actual: number;
  achievementPct: number;
  weight: number;
  payout: number;
}

export type RepPayoutStatus =
  | "Pending"
  | "Approved"
  | "Paid"
  | "Failed"
  | "Disputed"
  | "On hold";

export interface RepPayout {
  id: string;
  name: string;
  code: string;
  role: string;
  division: string;
  region: string;
  kpis: KpiBreakdown[];
  gross: number;
  gateDeduction: number;
  clawbackAdj: number;
  net: number;
  method: PayoutMethod;
  split: { method: PayoutMethod; pct: number }[];
  status: RepPayoutStatus;
  failureReason?: string;
}

export interface ApprovalStep {
  level: "Step 1 — Sales Ops" | "Step 2 — Finance";
  approver: string;
  state: "Approved" | "Rejected" | "Pending";
  at?: string;
  comment?: string;
}

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface PayoutRun {
  id: string;
  programme: string;
  period: string;
  month: number;
  year: number;
  totalReps: number;
  totalAmount: number;
  status: RunStatus;
  createdAt: string;
  utr?: string;
  rejectionReason?: string;
  approvals: ApprovalStep[];
  audit: AuditEvent[];
  reps: RepPayout[];
}

export interface Dispute {
  id: string;
  rep: string;
  programme: string;
  period: string;
  runId: string;
  amount: number;
  reason: string;
  raisedOn: string;
  ageDays: number;
  status: "Open" | "Under Review" | "Resolved" | "Rejected";
  resolutionNote?: string;
}

export interface Clawback {
  id: string;
  rep: string;
  originalRunId: string;
  amount: number;
  recovered: number;
  reason: "Sale reversal" | "Return" | "Bounced cheque" | "Overpayment";
  nextCycle: string;
  status: "Scheduled" | "Partially recovered" | "Recovered" | "Waived";
}

export interface RewardProvider {
  id: string;
  name: string;
  kind: PayoutMethod;
  blurb: string;
  connected: boolean;
  float: number;
  fee: string;
  tat: string;
  coverage: string;
}

export interface RewardItem {
  id: string;
  brand: string;
  category: string;
  provider: string;
  denominations: number[];
  tat: string;
  enabled: boolean;
}

export interface Redemption {
  id: string;
  runId: string;
  rep: string;
  brand: string;
  amount: number;
  code: string;
  channel: "SMS" | "Email" | "In-app";
  status: "Delivered" | "Pending" | "Failed" | "Redeemed";
  issuedOn: string;
}

export const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const fmtCompact = (n: number) => {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
};

export const METHOD_LABEL: Record<PayoutMethod, string> = {
  Bank: "Bank transfer",
  Amazon: "Amazon Pay",
  Voucher: "Voucher",
  Wallet: "Wallet & points",
};

export const METHOD_STYLE: Record<PayoutMethod, string> = {
  Bank: "bg-sky-50 text-sky-700 border-sky-200",
  Amazon: "bg-amber-50 text-amber-700 border-amber-200",
  Voucher: "bg-violet-50 text-violet-700 border-violet-200",
  Wallet: "bg-teal-50 text-teal-700 border-teal-200",
};

export const METHOD_HEX: Record<PayoutMethod, string> = {
  Bank: "#0284c7",
  Amazon: "#d97706",
  Voucher: "#7c3aed",
  Wallet: "#0d9488",
};

export const STATUS_STYLES: Record<RunStatus, string> = {
  Draft: "bg-muted text-muted-foreground border-border",
  Calculated: "bg-slate-100 text-slate-700 border-slate-300",
  "Awaiting Sales Ops": "bg-amber-50 text-amber-700 border-amber-300",
  "Awaiting Finance": "bg-amber-100 text-amber-800 border-amber-300",
  Approved: "bg-blue-50 text-blue-700 border-blue-300",
  Processing: "bg-indigo-50 text-indigo-700 border-indigo-300",
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-300",
  "Partially failed": "bg-rose-50 text-rose-700 border-rose-300",
  Closed: "bg-slate-100 text-slate-600 border-slate-300",
};

export const RUN_LIFECYCLE: RunStatus[] = [
  "Draft",
  "Calculated",
  "Awaiting Sales Ops",
  "Awaiting Finance",
  "Approved",
  "Processing",
  "Paid",
  "Closed",
];

const REP_SEEDS: [string, string, string, string, string][] = [
  ["Rahul Sharma", "MR-4412", "Urban Retail MR", "CCD", "West"],
  ["Priya Nair", "MR-4419", "Hybrid MR", "HCD", "South"],
  ["Aman Verma", "AS-2201", "ASO/ASE", "CCD", "North"],
  ["Sneha Iyer", "MR-5533", "Rural MR (Super Stockist)", "HCD", "South"],
  ["Vikram Singh", "MR-4470", "Urban Wholesale MR", "CCD", "North"],
  ["Neha Gupta", "MR-4488", "Urban Retail MR", "CCD", "East"],
  ["Imran Khan", "MR-4491", "Hybrid MR", "HCD", "West"],
  ["Kavya Reddy", "AS-2288", "ASO/ASE", "CCD", "South"],
];

const KPI_DEFS: [string, number, number][] = [
  ["NSV", 900_000, 0.4],
  ["Productive Coverage", 180, 0.25],
  ["New Outlet Opening", 22, 0.2],
  ["NPD First Activation", 40, 0.15],
];

const METHODS: PayoutMethod[] = ["Bank", "Amazon", "Voucher", "Wallet"];

const FAILURES = [
  "Invalid IFSC on file",
  "KYC pending — PAN not verified",
  "Gift card issuance failed at provider",
  "Bank account frozen",
];

export const makeReps = (seed: number, count = 8): RepPayout[] =>
  REP_SEEDS.slice(0, count).map(([name, code, role, division, region], i) => {
    const kpis: KpiBreakdown[] = KPI_DEFS.map(([kpi, target, weight], j) => {
      const pct = 52 + ((seed * 13 + i * 17 + j * 29) % 68);
      const payout = Math.round(target * weight * 0.02 * (pct / 100));
      return {
        kpi,
        target,
        actual: Math.round((target * pct) / 100),
        achievementPct: pct,
        weight: Math.round(weight * 100),
        payout,
      };
    });
    const gross = kpis.reduce((s, k) => s + k.payout, 0);
    const gateDeduction = (seed + i) % 4 === 0 ? Math.round(gross * 0.12) : 0;
    const clawbackAdj = (seed + i) % 7 === 0 ? -Math.round(gross * 0.05) : 0;
    const method = METHODS[(seed + i) % METHODS.length];
    const failed = (seed + i) % 11 === 0;
    const split =
      method === "Bank"
        ? [{ method: "Bank" as PayoutMethod, pct: 100 }]
        : [
            { method: "Bank" as PayoutMethod, pct: 70 },
            { method, pct: 30 },
          ];
    return {
      id: `rep-${seed}-${i}`,
      name,
      code,
      role,
      division,
      region,
      kpis,
      gross,
      gateDeduction,
      clawbackAdj,
      net: gross - gateDeduction + clawbackAdj,
      method,
      split,
      status: (failed ? "Failed" : "Pending") as RepPayoutStatus,
      failureReason: failed ? FAILURES[(seed + i) % FAILURES.length] : undefined,
    };
  });

const audit = (rows: [string, string, string, string?][]): AuditEvent[] =>
  rows.map(([at, actor, action, detail]) => ({ at, actor, action, detail }));

export const INITIAL_RUNS: PayoutRun[] = [
  {
    id: "PR-2026-07-001",
    programme: "Urban MR — Monthly Q2",
    period: "Jul 2026",
    month: 7,
    year: 2026,
    totalReps: 142,
    totalAmount: 1_842_500,
    status: "Awaiting Finance",
    createdAt: "2026-08-02",
    approvals: [
      {
        level: "Step 1 — Sales Ops",
        approver: "Ananya Rao",
        state: "Approved",
        at: "2026-08-02 14:10",
        comment: "Attainment reconciled with SFA extract.",
      },
      { level: "Step 2 — Finance", approver: "Sanjay Mehta", state: "Pending" },
    ],
    audit: audit([
      ["2026-08-01 22:05", "System", "Run calculated", "142 reps · 4 KPIs"],
      ["2026-08-02 09:40", "Ananya Rao", "Rep adjustments", "2 reps put on hold"],
      ["2026-08-02 14:10", "Ananya Rao", "Sales Ops approved"],
    ]),
    reps: makeReps(1),
  },
  {
    id: "PR-2026-07-002",
    programme: "Rural SS Programme",
    period: "Jul 2026",
    month: 7,
    year: 2026,
    totalReps: 86,
    totalAmount: 921_300,
    status: "Approved",
    createdAt: "2026-08-01",
    approvals: [
      { level: "Step 1 — Sales Ops", approver: "Ananya Rao", state: "Approved", at: "2026-08-01 11:02" },
      { level: "Step 2 — Finance", approver: "Sanjay Mehta", state: "Approved", at: "2026-08-01 17:35" },
    ],
    audit: audit([
      ["2026-07-31 21:00", "System", "Run calculated", "86 reps"],
      ["2026-08-01 17:35", "Sanjay Mehta", "Finance approved"],
    ]),
    reps: makeReps(2),
  },
  {
    id: "PR-2026-06-003",
    programme: "ASO Quarterly Bonus",
    period: "Jun 2026",
    month: 6,
    year: 2026,
    totalReps: 38,
    totalAmount: 615_000,
    status: "Paid",
    createdAt: "2026-07-05",
    utr: "HDFC0026071500881",
    approvals: [
      { level: "Step 1 — Sales Ops", approver: "Ananya Rao", state: "Approved", at: "2026-07-05 10:00" },
      { level: "Step 2 — Finance", approver: "Sanjay Mehta", state: "Approved", at: "2026-07-05 16:20" },
    ],
    audit: audit([
      ["2026-07-05 16:20", "Sanjay Mehta", "Finance approved"],
      ["2026-07-06 09:15", "System", "Bank file exported", "38 records"],
      ["2026-07-07 12:02", "Sanjay Mehta", "Marked paid", "UTR HDFC0026071500881"],
    ]),
    reps: makeReps(3),
  },
  {
    id: "PR-2026-06-004",
    programme: "Urban MR — Monthly Q2",
    period: "Jun 2026",
    month: 6,
    year: 2026,
    totalReps: 140,
    totalAmount: 1_756_800,
    status: "Partially failed",
    createdAt: "2026-07-04",
    approvals: [
      { level: "Step 1 — Sales Ops", approver: "Ananya Rao", state: "Approved", at: "2026-07-04 10:40" },
      { level: "Step 2 — Finance", approver: "Sanjay Mehta", state: "Approved", at: "2026-07-04 18:05" },
    ],
    audit: audit([
      ["2026-07-04 18:05", "Sanjay Mehta", "Finance approved"],
      ["2026-07-05 08:30", "System", "Payment started"],
      ["2026-07-05 09:10", "System", "6 payouts failed", "Bank + card issuance errors"],
    ]),
    reps: makeReps(4),
  },
  {
    id: "PR-2026-08-005",
    programme: "Hybrid MR Drive",
    period: "Aug 2026",
    month: 8,
    year: 2026,
    totalReps: 64,
    totalAmount: 412_400,
    status: "Draft",
    createdAt: "2026-08-30",
    approvals: [
      { level: "Step 1 — Sales Ops", approver: "Ananya Rao", state: "Pending" },
      { level: "Step 2 — Finance", approver: "Sanjay Mehta", state: "Pending" },
    ],
    audit: audit([["2026-08-30 07:00", "System", "Draft created"]]),
    reps: makeReps(5),
  },
  {
    id: "PR-2026-07-006",
    programme: "NPD Push — Northeast",
    period: "Jul 2026",
    month: 7,
    year: 2026,
    totalReps: 51,
    totalAmount: 338_900,
    status: "Awaiting Sales Ops",
    createdAt: "2026-08-03",
    approvals: [
      { level: "Step 1 — Sales Ops", approver: "Ananya Rao", state: "Pending" },
      { level: "Step 2 — Finance", approver: "Sanjay Mehta", state: "Pending" },
    ],
    audit: audit([["2026-08-03 06:15", "System", "Run calculated", "51 reps"]]),
    reps: makeReps(6),
  },
];

export const INITIAL_DISPUTES: Dispute[] = [
  {
    id: "DSP-001",
    rep: "Aman Verma",
    programme: "Urban MR — Monthly Q2",
    period: "Jun 2026",
    runId: "PR-2026-06-004",
    amount: 4500,
    reason: "NSV achievement under-counted — distributor invoice mismatch.",
    raisedOn: "2026-07-08",
    ageDays: 26,
    status: "Open",
  },
  {
    id: "DSP-002",
    rep: "Priya Nair",
    programme: "Rural SS Programme",
    period: "Jun 2026",
    runId: "PR-2026-06-003",
    amount: 2800,
    reason: "New outlet activations not reflected for week 3.",
    raisedOn: "2026-07-14",
    ageDays: 20,
    status: "Under Review",
  },
  {
    id: "DSP-003",
    rep: "Kavya Reddy",
    programme: "ASO Quarterly Bonus",
    period: "Jun 2026",
    runId: "PR-2026-06-003",
    amount: 1900,
    reason: "Gift card never delivered to registered mobile.",
    raisedOn: "2026-07-20",
    ageDays: 14,
    status: "Open",
  },
];

export const INITIAL_CLAWBACKS: Clawback[] = [
  {
    id: "CB-001",
    rep: "Vikram Singh",
    originalRunId: "PR-2026-06-003",
    amount: 3200,
    recovered: 3200,
    reason: "Bounced cheque",
    nextCycle: "Aug 2026",
    status: "Recovered",
  },
  {
    id: "CB-002",
    rep: "Neha Gupta",
    originalRunId: "PR-2026-06-004",
    amount: 5400,
    recovered: 2000,
    reason: "Return",
    nextCycle: "Aug 2026",
    status: "Partially recovered",
  },
  {
    id: "CB-003",
    rep: "Imran Khan",
    originalRunId: "PR-2026-07-001",
    amount: 1800,
    recovered: 0,
    reason: "Sale reversal",
    nextCycle: "Sep 2026",
    status: "Scheduled",
  },
];

export const INITIAL_PROVIDERS: RewardProvider[] = [
  {
    id: "bank",
    name: "Bank transfer (NEFT / IMPS / UPI)",
    kind: "Bank",
    blurb: "Direct credit to the rep's verified bank account or UPI handle.",
    connected: true,
    float: 4_500_000,
    fee: "₹4 per transaction",
    tat: "Same day (IMPS) · T+1 (NEFT)",
    coverage: "All Indian banks",
  },
  {
    id: "amazon",
    name: "Amazon Pay gift cards",
    kind: "Amazon",
    blurb: "Instant Amazon Pay balance codes issued per rep via Amazon Incentives.",
    connected: true,
    float: 850_000,
    fee: "0% (bulk purchase discount 2%)",
    tat: "Instant",
    coverage: "amazon.in · 50L+ products",
  },
  {
    id: "vouchers",
    name: "Multi-brand voucher catalogue",
    kind: "Voucher",
    blurb: "Flipkart, fuel, groceries, electronics and food brands through one aggregator.",
    connected: false,
    float: 0,
    fee: "1.5% platform fee",
    tat: "Instant to 2 hrs",
    coverage: "120+ brands",
  },
  {
    id: "wallet",
    name: "Wallet & points",
    kind: "Wallet",
    blurb: "Load earnings into the in-app wallet as points, redeemable any time.",
    connected: true,
    float: 220_000,
    fee: "No fee",
    tat: "Instant",
    coverage: "In-app only",
  },
];

export const REWARD_CATALOGUE: RewardItem[] = [
  { id: "rw-1", brand: "Amazon Pay", category: "Marketplace", provider: "Amazon", denominations: [250, 500, 1000, 2000, 5000], tat: "Instant", enabled: true },
  { id: "rw-2", brand: "Flipkart", category: "Marketplace", provider: "Voucher aggregator", denominations: [500, 1000, 2000], tat: "Instant", enabled: true },
  { id: "rw-3", brand: "Indian Oil Fuel", category: "Fuel", provider: "Voucher aggregator", denominations: [500, 1000], tat: "2 hrs", enabled: true },
  { id: "rw-4", brand: "BigBasket", category: "Groceries", provider: "Voucher aggregator", denominations: [250, 500, 1000], tat: "Instant", enabled: true },
  { id: "rw-5", brand: "Swiggy Money", category: "Food", provider: "Voucher aggregator", denominations: [250, 500], tat: "Instant", enabled: false },
  { id: "rw-6", brand: "Croma", category: "Electronics", provider: "Voucher aggregator", denominations: [1000, 2500, 5000], tat: "Instant", enabled: false },
  { id: "rw-7", brand: "Wallet points", category: "In-app", provider: "Wallet", denominations: [100, 250, 500, 1000], tat: "Instant", enabled: true },
  { id: "rw-8", brand: "UPI voucher", category: "Cash-like", provider: "Wallet", denominations: [500, 1000], tat: "Instant", enabled: true },
];

export const INITIAL_REDEMPTIONS: Redemption[] = [
  { id: "RD-1001", runId: "PR-2026-06-003", rep: "Rahul Sharma", brand: "Amazon Pay", amount: 2000, code: "AMZN-XXXX-4417", channel: "SMS", status: "Redeemed", issuedOn: "2026-07-07" },
  { id: "RD-1002", runId: "PR-2026-06-003", rep: "Priya Nair", brand: "Flipkart", amount: 1000, code: "FKRT-XXXX-9021", channel: "In-app", status: "Delivered", issuedOn: "2026-07-07" },
  { id: "RD-1003", runId: "PR-2026-06-004", rep: "Kavya Reddy", brand: "Amazon Pay", amount: 1500, code: "AMZN-XXXX-7735", channel: "SMS", status: "Failed", issuedOn: "2026-07-05" },
  { id: "RD-1004", runId: "PR-2026-06-004", rep: "Imran Khan", brand: "Indian Oil Fuel", amount: 1000, code: "IOCL-XXXX-3390", channel: "Email", status: "Delivered", issuedOn: "2026-07-05" },
  { id: "RD-1005", runId: "PR-2026-07-002", rep: "Sneha Iyer", brand: "Wallet points", amount: 750, code: "WLT-XXXX-1120", channel: "In-app", status: "Pending", issuedOn: "2026-08-02" },
  { id: "RD-1006", runId: "PR-2026-07-002", rep: "Neha Gupta", brand: "BigBasket", amount: 500, code: "BBKT-XXXX-6642", channel: "SMS", status: "Redeemed", issuedOn: "2026-08-02" },
];

export interface MethodPolicy {
  programme: string;
  defaultMethod: PayoutMethod;
  allowed: PayoutMethod[];
  maxNonCashPct: number;
  minBankPct: number;
}

export const INITIAL_POLICIES: MethodPolicy[] = [
  { programme: "Urban MR — Monthly Q2", defaultMethod: "Bank", allowed: ["Bank", "Amazon", "Voucher"], maxNonCashPct: 50, minBankPct: 50 },
  { programme: "Rural SS Programme", defaultMethod: "Bank", allowed: ["Bank", "Wallet"], maxNonCashPct: 30, minBankPct: 70 },
  { programme: "ASO Quarterly Bonus", defaultMethod: "Amazon", allowed: ["Bank", "Amazon", "Voucher", "Wallet"], maxNonCashPct: 100, minBankPct: 0 },
  { programme: "Hybrid MR Drive", defaultMethod: "Bank", allowed: ["Bank", "Amazon"], maxNonCashPct: 40, minBankPct: 60 },
];

export const methodMix = (run: PayoutRun) => {
  const totals: Record<PayoutMethod, number> = { Bank: 0, Amazon: 0, Voucher: 0, Wallet: 0 };
  run.reps.forEach((r) => r.split.forEach((s) => (totals[s.method] += (r.net * s.pct) / 100)));
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return (Object.keys(totals) as PayoutMethod[])
    .map((m) => ({ method: m, amount: totals[m], pct: (totals[m] / sum) * 100 }))
    .filter((x) => x.pct > 0.5);
};
