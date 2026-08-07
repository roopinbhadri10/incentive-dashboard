// Client for the programme analytics endpoint (`GET /v1/programs/analytics`).
//
// This is the authoritative source for attainment, payout, budget, KPI health
// and coverage figures. Nothing in the UI should derive these numbers itself —
// anything this endpoint doesn't return is genuinely unknown and must read as
// "Awaiting data" rather than being invented.
//
// Sits alongside the rules endpoint, derived from the same incentive base URL
// (see config/incentiveApi): a relative Vite-proxied path in dev, the real host
// in production.

import { getTenantId, getAuthorizationHeader } from "@/config/auth";
import { ANALYTICS_ENDPOINT } from "@/config/incentiveApi";
import { ApiError } from "@/lib/apiError";

/** Per-KPI attainment inside a programme. */
export interface KpiPerformance {
  kpiKey: string;
  kpiName: string;
  attainmentPct: number;
  /** Server-computed bar width (0-100), so the UI doesn't rescale it itself. */
  barWidthPct: number;
  statusTag: "ON_TRACK" | "WATCH" | "AT_RISK" | string;
  statusLabel: string;
  projectedPayout: number;
  /** Share of the programme's payout arc (0-100). */
  arcSharePct: number;
}

/** One programme's analytics, keyed by the `programId` stamped on its rules. */
export interface ProgramAnalytics {
  programId: string;
  programName: string;
  /** `YYYY-MM`. */
  period: string;
  status: string;
  budgetUsed: number;
  budgetUsedPct: number;
  totalBudget: number;
  maxMonthlyEarning: number;
  overallAttainmentPct: number;
  attainmentDelta: number;
  estimatedPayout: number;
  kpisTotalCount: number;
  kpisOnTrackCount: number;
  kpisNeedAttentionCount: number;
  kpiTrackSublabel: string;
  gatesCount: number;
  rolesCoveredCount: number;
  totalUsers: number;
  engagedUsers: number;
  engagedPct: number;
  kpiPerformanceList: KpiPerformance[];
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/json",
    "X-Tenant-Id": getTenantId(),
  };
  const auth = getAuthorizationHeader();
  if (auth) h["Authorization"] = auth;
  return h;
}

/**
 * Fetch analytics for every programme in the tenant. Returns [] when the tenant
 * has none — callers treat an empty list as "no data yet", not as an error.
 */
export async function fetchProgramAnalytics(): Promise<ProgramAnalytics[]> {
  const res = await fetch(ANALYTICS_ENDPOINT, {
    headers: headers(),
    credentials: "include",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(res.status, detail, "Analytics API");
  }
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? (data as ProgramAnalytics[]) : [];
}

/** Index analytics by programId for joining onto the programmes list. */
export function byProgramId(list: ProgramAnalytics[]): Map<string, ProgramAnalytics> {
  return new Map(list.map((a) => [a.programId, a]));
}

/** Users-weighted mean attainment — a plain mean would let a 2-rep programme
 *  swing the headline as hard as a 500-rep one. Falls back to a plain mean when
 *  no programme reports users yet. */
export function weightedAttainment(list: ProgramAnalytics[]): number {
  if (list.length === 0) return 0;
  const users = list.reduce((s, a) => s + (a.totalUsers || 0), 0);
  if (users > 0) {
    return Math.round(
      list.reduce((s, a) => s + a.overallAttainmentPct * (a.totalUsers || 0), 0) / users,
    );
  }
  return Math.round(list.reduce((s, a) => s + a.overallAttainmentPct, 0) / list.length);
}
