// Single source of truth for analytics numbers.
// Everything here is derived from `mockProgrammes` — the SAME data that powers
// the Programmes list, the Create wizard and the Clone & Modify flow — so the
// Analytics section can never drift from the rest of the product.

import { mockProgrammes } from "@/data/mockData";
import type { Programme, RoleType, ProgrammeStatus, KpiConfig } from "@/types/programme";

// ─── Labels (shared with the Programmes list) ───────────────────────────────
export const KPI_LABELS: Record<string, string> = {
  A_nsv: "Net Sales Value",
  B_phasing: "Sales Phasing",
  C_eco: "Effective Coverage",
  D_tlsd: "TLSD",
  E_dbb: "Must-sell Brand Billing",
  F_cft: "Field Time Compliance",
  G_subDbBilling: "Sub-DB Billing",
  H_msb: "Must-Sell SKUs",
  I_channelFocus: "Channel Focus",
  J_teamEarning: "Team Earning",
  K_appUsage: "App Usage",
  L_quarterly: "Quarterly NSV",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatPeriod(p: Programme["period"]): string {
  return `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

export function formatRole(role: RoleType): string {
  switch (role) {
    case "MR": return "MR";
    case "ASO_ASE": return "ASO/ASE";
    case "ASO": return "ASO";
    case "ASM": return "ASM";
  }
}

export function formatSegment(p: Programme): string | null {
  if (p.geography === "kerala") return "Kerala territory";
  switch (p.segment) {
    case "urban-retail": return "Urban · Retail";
    case "urban-wholesale": return "Urban · Wholesale";
    case "rural-ss": return "Rural (SS)";
    case "hybrid": return "Hybrid";
    case "urban": return "Urban";
    case "rural": return "Rural";
    case "urban-cities": return "Urban cities";
    case "other-markets": return "Other markets";
    case "all": return null;
  }
}

export function formatGeography(p: Programme): string {
  switch (p.geography) {
    case "all-india": return "All India";
    case "kerala": return "Kerala";
    case "urban-cities": return "Urban cities";
    case "other-markets": return "Other markets";
  }
}

export const CHANNEL_STYLE: Record<Programme["channel"], { bg: string; fg: string; label: string }> = {
  CCD: { bg: "rgba(0,109,78,0.10)", fg: "#006D4E", label: "CCD" },
  HCD: { bg: "rgba(72,61,158,0.10)", fg: "#483D9E", label: "HCD" },
};

export function statusMetaOf(status: ProgrammeStatus) {
  switch (status) {
    case "active":
      return { label: "Active", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" };
    case "draft":
      return { label: "Draft", dot: "bg-orange-500", pill: "bg-orange-50 text-orange-700" };
    case "locked":
      return { label: "Locked", dot: "bg-muted-foreground/60", pill: "bg-muted text-muted-foreground" };
    default:
      return { label: "Archived", dot: "bg-muted-foreground/60", pill: "bg-muted text-muted-foreground" };
  }
}

export function formatInr(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount >= 100000000 ? 0 : 1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount >= 1000000 ? 0 : 1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

// ─── Deterministic mock signals (identical maths to the Programmes list) ────
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * 0 = easy (pays from a low threshold), 1 = hard (only pays near/above 100%).
 * Derived from the KPI's own configured slabs so difficulty is not invented.
 */
export function kpiDifficulty(cfg?: KpiConfig): number {
  if (!cfg) return 0.5;
  const thresholds: number[] = [];
  if (cfg.linearSlab?.minPct != null) thresholds.push(cfg.linearSlab.minPct);
  if (cfg.flatTrigger?.thresholdPct != null) thresholds.push(cfg.flatTrigger.thresholdPct);
  if (cfg.tieredSlab?.tiers?.length) thresholds.push(cfg.tieredSlab.tiers[0].thresholdPct);
  if (cfg.phasingSlab) thresholds.push(cfg.phasingSlab.t55);
  if (!thresholds.length) return 0.5;
  const entry = Math.min(...thresholds);
  return Math.max(0, Math.min(1, (entry - 60) / 45));
}

/** Configured max payout of a KPI — its weight inside the programme roll-up. */
export function kpiWeight(cfg?: KpiConfig): number {
  if (!cfg) return 1;
  const w =
    cfg.linearSlab?.capAmount ??
    cfg.ecoConfig?.maxPayout ??
    cfg.perLineSlab?.maxPayout ??
    cfg.flatTrigger?.payout ??
    cfg.payoutAmount ??
    (cfg.tieredSlab?.tiers?.length
      ? Math.max(...cfg.tieredSlab.tiers.map((t) => t.payout))
      : 0);
  return w > 0 ? w : 1;
}

/**
 * Attainment for a KPI on a programme. Seeded (stable across renders) but
 * shaped by the KPI's configured entry threshold: a harder KPI centres lower.
 */
export function mockAttainment(programmeId: string, kpiKey: string, cfg?: KpiConfig): number {
  const centre = 104 - kpiDifficulty(cfg) * 30; // easy ≈ 104%, hard ≈ 74%
  const jitter = (hashSeed(programmeId + kpiKey) % 41) - 20; // ±20
  return Math.max(30, Math.min(130, Math.round(centre + jitter)));
}

export interface ProgrammeQuickStats {
  status: "active" | "draft" | "ended";
  maxPayoutPerUser: number;
  totalUsers: number;
  engagedUsers: number;
  engagedPct: number;
  totalBudget: number;
  budgetUsed: number;
  budgetUsedPct: number;
  attainmentPct: number;
}

export function computeProgrammeStats(p: Programme): ProgrammeQuickStats {
  const seed = [...p.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const rand = (offset: number, range: number) => (seed * 9301 + offset * 49297) % range;

  const roleBase: Record<RoleType, number> = { MR: 80, ASO_ASE: 45, ASO: 50, ASM: 18 };
  const totalUsers = roleBase[p.role] + rand(1, 35);
  const maxPayoutPerUser = p.maxMonthlyEarning;
  const totalBudget = maxPayoutPerUser * totalUsers;

  if (p.status === "draft") {
    return {
      status: "draft",
      maxPayoutPerUser,
      totalUsers,
      engagedUsers: 0,
      engagedPct: 0,
      totalBudget,
      budgetUsed: 0,
      budgetUsedPct: 0,
      attainmentPct: 0,
    };
  }

  const isEnded = p.status === "locked" || p.status === "archived";
  const engagedPct = isEnded ? 70 + rand(2, 25) : 55 + rand(2, 40);
  const engagedUsers = Math.round((totalUsers * engagedPct) / 100);
  const budgetUsedPct = isEnded ? 65 + rand(3, 30) : 30 + rand(3, 55);
  const budgetUsed = Math.round((totalBudget * budgetUsedPct) / 100);
  const attainmentPct = isEnded ? 70 + rand(4, 25) : 45 + rand(4, 50);

  return {
    status: isEnded ? "ended" : "active",
    maxPayoutPerUser,
    totalUsers,
    engagedUsers,
    engagedPct,
    totalBudget,
    budgetUsed,
    budgetUsedPct,
    attainmentPct,
  };
}

// ─── Per-programme analytics record ─────────────────────────────────────────
export interface ProgrammeAnalytics {
  programme: Programme;
  id: string;
  name: string;
  channel: Programme["channel"];
  role: RoleType;
  roleLabel: string;
  segmentLabel: string | null;
  geographyLabel: string;
  periodLabel: string;
  status: ProgrammeStatus;
  kpis: Array<{ key: string; label: string; attainment: number; weight: number }>;
  gateCount: number;
  overall: number;
  estPayout: number;
  maxPayoutPerUser: number;
  totalUsers: number;
  engagedUsers: number;
  engagedPct: number;
  totalBudget: number;
  budgetUsed: number;
  budgetUsedPct: number;
  /** Sales value attributed to the programme (mock uplift model). */
  salesImpact: number;
  roi: number;
}

export function analyseProgramme(p: Programme): ProgrammeAnalytics {
  const stats = computeProgrammeStats(p);
  const kpis = Object.entries(p.kpis)
    .filter(([, cfg]) => cfg?.enabled)
    .map(([key, cfg]) => ({
      key,
      label: KPI_LABELS[key] ?? key,
      attainment: mockAttainment(p.id, key, cfg),
      weight: kpiWeight(cfg),
    }));

  // Payout-weighted: a KPI carrying more money moves the programme more.
  const weightSum = kpis.reduce((s, k) => s + k.weight, 0);
  const overall = weightSum
    ? Math.round(kpis.reduce((s, k) => s + k.attainment * k.weight, 0) / weightSum)
    : 0;
  const estPayout = Math.round(p.maxMonthlyEarning * (overall / 100));
  const gateCount = Object.values(p.gates).filter((v) => (typeof v === "number" ? v > 0 : Boolean(v))).length;

  // Mock uplift: payout spend × a multiplier that scales with attainment.
  const multiplier = 1.2 + (overall / 100) * 2.2;
  const salesImpact = Math.round(stats.budgetUsed * multiplier);

  return {
    programme: p,
    id: p.id,
    name: p.name,
    channel: p.channel,
    role: p.role,
    roleLabel: formatRole(p.role),
    segmentLabel: formatSegment(p),
    geographyLabel: formatGeography(p),
    periodLabel: formatPeriod(p.period),
    status: p.status,
    kpis,
    gateCount,
    overall,
    estPayout,
    maxPayoutPerUser: stats.maxPayoutPerUser,
    totalUsers: stats.totalUsers,
    engagedUsers: stats.engagedUsers,
    engagedPct: stats.engagedPct,
    totalBudget: stats.totalBudget,
    budgetUsed: stats.budgetUsed,
    budgetUsedPct: stats.budgetUsedPct,
    salesImpact,
    roi: stats.budgetUsed > 0 ? salesImpact / stats.budgetUsed : 0,
  };
}

/**
 * Analyse a programme list. Ordered exactly like the Programmes list, so the
 * Analytics section always reports on the same programmes the user sees under
 * Programmes / Create / Clone.
 */
export function analyseProgrammes(list: Programme[]): ProgrammeAnalytics[] {
  return list.map(analyseProgramme);
}

/** Live (non-draft) programmes — what the Analytics section reports on. */
export function liveAnalyticsFor(list: Programme[]): ProgrammeAnalytics[] {
  return analyseProgrammes(list).filter((a) => a.status !== "draft");
}

/** Demo programmes, used only when the rules engine returns nothing. */
export const demoProgrammes: Programme[] = mockProgrammes;

// ─── Shared health scale ────────────────────────────────────────────────────
export function healthOf(att: number) {
  if (att >= 90)
    return {
      label: "On track",
      pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
      bar: "bg-emerald-500",
      hsl: "hsl(var(--status-ok))",
    };
  if (att >= 70)
    return {
      label: "Watch",
      pill: "bg-amber-50 text-amber-800 border-amber-200",
      bar: "bg-amber-500",
      hsl: "hsl(var(--status-watch))",
    };
  return {
    label: "At risk",
    pill: "bg-rose-50 text-rose-700 border-rose-200",
    bar: "bg-rose-500",
    hsl: "hsl(var(--status-risk))",
  };
}
