// Deterministic rep-level analytics layer.
// Every programme gets a synthetic roster whose attainment/earnings roll up
// exactly into the programme record produced by `programmeAnalytics.ts`.
// Nothing here is random at runtime — same input, same output, every render.

import type { Programme } from "@/types/programme";
import {
  hashSeed,
  type ProgrammeAnalytics,
} from "./programmeAnalytics";

import { REGION_STATES, STATE_NAMES, STATE_REGION } from "./indiaGeo";

export { kpiDifficulty, kpiWeight } from "./programmeAnalytics";

// ─── Rep roster ─────────────────────────────────────────────────────────────
const FIRST = [
  "Rahul", "Priya", "Amit", "Sneha", "Vikram", "Neha", "Imran", "Kavya",
  "Arjun", "Divya", "Rohit", "Meera", "Sanjay", "Ananya", "Karthik", "Pooja",
  "Manish", "Ritu", "Suresh", "Farah", "Nikhil", "Swati", "Aditya", "Leela",
];
const LAST = [
  "Sharma", "Nair", "Patel", "Iyer", "Singh", "Gupta", "Khan", "Reddy",
  "Menon", "Joshi", "Verma", "Das", "Bose", "Rao", "Kulkarni", "Shetty",
];
const REGIONS = ["North", "South", "East", "West", "Central"];

export interface RepRecord {
  id: string;
  name: string;
  empId: string;
  programmeId: string;
  programmeName: string;
  channel: Programme["channel"];
  roleLabel: string;
  region: string;
  /** Indian state the rep works in — drives the geography view. */
  state: string;
  attainment: number;
  earnings: number;
  maxEarnings: number;
  /** Failed at least one gate this period. */
  gateFailed: boolean;
  /** Earned nothing — either gated out or below every entry slab. */
  zeroEarner: boolean;
}

/** Payout curve: nothing below 70, then accelerating up to the cap. */
function earningsFor(attainment: number, maxEarnings: number, gateFailed: boolean): number {
  if (gateFailed) return 0;
  if (attainment < 70) return 0;
  const t = Math.min(1, (attainment - 70) / 45); // 70 → 0, 115 → 1
  return Math.round(maxEarnings * Math.pow(t, 1.35));
}

function buildRepsFor(a: ProgrammeAnalytics): RepRecord[] {
  const reps: RepRecord[] = [];
  for (let i = 0; i < a.totalUsers; i++) {
    const h = hashSeed(`${a.id}:rep:${i}`);
    const name = `${FIRST[h % FIRST.length]} ${LAST[(h >> 5) % LAST.length]}`;
    // Bell-ish spread around the programme's overall attainment.
    const spread = ((h >> 3) % 100) / 100 + ((h >> 11) % 100) / 100 - 1; // -1..1, centre-weighted
    const attainment = Math.max(28, Math.min(132, Math.round(a.overall + spread * 32)));
    const gateFailed = (h >> 17) % 9 === 0 && attainment < 95;
    const maxEarnings = a.maxPayoutPerUser;
    const earnings = earningsFor(attainment, maxEarnings, gateFailed);
    // Kerala-scoped programmes stay in Kerala; everything else spreads over
    // the states inside a deterministically picked sales region.
    const keralaOnly = /kerala/i.test(a.geographyLabel ?? "");
    const region = keralaOnly ? "South" : REGIONS[(h >> 7) % REGIONS.length];
    const pool = REGION_STATES[region] ?? STATE_NAMES;
    const state = keralaOnly ? "Kerala" : pool[(h >> 13) % pool.length];

    reps.push({
      id: `${a.id}-r${i}`,
      name,
      empId: `EMP-${10000 + (h % 89999)}`,
      programmeId: a.id,
      programmeName: a.name,
      channel: a.channel,
      roleLabel: a.roleLabel,
      region,
      state,
      attainment,
      earnings,
      maxEarnings,
      gateFailed,
      zeroEarner: earnings === 0,
    });
  }
  return reps;
}

/** Every rep across the supplied live programmes. */
export function buildAllReps(live: ProgrammeAnalytics[]): RepRecord[] {
  return live.flatMap(buildRepsFor);
}

export function repsForProgramme(reps: RepRecord[], programmeId: string): RepRecord[] {
  return reps.filter((r) => r.programmeId === programmeId);
}

// ─── Distribution & concentration helpers ───────────────────────────────────
export interface AttainmentBand {
  label: string;
  min: number;
  max: number;
  reps: number;
  payout: number;
  pct: number;
}

const BAND_DEFS: Array<{ label: string; min: number; max: number }> = [
  { label: "Below 70%", min: 0, max: 70 },
  { label: "70 – 89%", min: 70, max: 90 },
  { label: "90 – 99%", min: 90, max: 100 },
  { label: "100 – 109%", min: 100, max: 110 },
  { label: "110%+", min: 110, max: Infinity },
];

export function attainmentBands(reps: RepRecord[]): AttainmentBand[] {
  const total = reps.length || 1;
  return BAND_DEFS.map((b) => {
    const inBand = reps.filter((r) => r.attainment >= b.min && r.attainment < b.max);
    const payout = inBand.reduce((s, r) => s + r.earnings, 0);
    return {
      label: b.label,
      min: b.min,
      max: b.max,
      reps: inBand.length,
      payout,
      pct: Math.round((inBand.length / total) * 100),
    };
  });
}

export interface QuartileSlice {
  label: string;
  reps: number;
  payout: number;
  avgPayout: number;
  sharePct: number;
}

/** Reps sorted by attainment, split into performance quartiles (Q1 = top). */
export function payoutQuartiles(reps: RepRecord[]): QuartileSlice[] {
  if (!reps.length) return [];
  const sorted = [...reps].sort((a, b) => b.attainment - a.attainment);
  const size = Math.ceil(sorted.length / 4);
  const totalPayout = sorted.reduce((s, r) => s + r.earnings, 0) || 1;
  const labels = ["Top 25%", "Upper mid", "Lower mid", "Bottom 25%"];
  return labels.map((label, i) => {
    const slice = sorted.slice(i * size, (i + 1) * size);
    const payout = slice.reduce((s, r) => s + r.earnings, 0);
    return {
      label,
      reps: slice.length,
      payout,
      avgPayout: slice.length ? Math.round(payout / slice.length) : 0,
      sharePct: Math.round((payout / totalPayout) * 100),
    };
  });
}

/**
 * Pay-for-performance ratio: average earnings of the top quartile divided by
 * the average of the bottom quartile. Higher = the plan differentiates.
 */
export function payForPerformanceRatio(reps: RepRecord[]): number | null {
  const q = payoutQuartiles(reps);
  if (q.length < 4) return null;
  const top = q[0].avgPayout;
  const bottom = q[3].avgPayout;
  if (bottom <= 0) return top > 0 ? Infinity : null;
  return top / bottom;
}

/** How far through the current calendar month we are, as a percentage. */
export function periodElapsedPct(): number {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.round((now.getDate() / days) * 100);
}

// ─── Geography roll-up ──────────────────────────────────────────────────────
export interface StateStats {
  state: string;
  region: string;
  users: number;
  earning: number;
  attainment: number;
  payout: number;
  maxPayout: number;
  gateFailed: number;
  programmes: Array<{ id: string; name: string; users: number; attainment: number; payout: number }>;
  topReps: RepRecord[];
}

/** Aggregate a rep list into per-state records. States with no reps are omitted. */
export function statsByState(reps: RepRecord[]): StateStats[] {
  const buckets = new Map<string, RepRecord[]>();
  for (const r of reps) {
    const list = buckets.get(r.state);
    if (list) list.push(r);
    else buckets.set(r.state, [r]);
  }
  return [...buckets.entries()]
    .map(([state, rs]) => {
      const byProg = new Map<string, RepRecord[]>();
      for (const r of rs) {
        const l = byProg.get(r.programmeId);
        if (l) l.push(r);
        else byProg.set(r.programmeId, [r]);
      }
      return {
        state,
        region: STATE_REGION[state] ?? "Central",
        users: rs.length,
        earning: rs.filter((r) => r.earnings > 0).length,
        attainment: Math.round(rs.reduce((s, r) => s + r.attainment, 0) / rs.length),
        payout: rs.reduce((s, r) => s + r.earnings, 0),
        maxPayout: rs.reduce((s, r) => s + r.maxEarnings, 0),
        gateFailed: rs.filter((r) => r.gateFailed).length,
        programmes: [...byProg.values()]
          .map((l) => ({
            id: l[0].programmeId,
            name: l[0].programmeName,
            users: l.length,
            attainment: Math.round(l.reduce((s, r) => s + r.attainment, 0) / l.length),
            payout: l.reduce((s, r) => s + r.earnings, 0),
          }))
          .sort((a, b) => b.payout - a.payout),
        topReps: [...rs].sort((a, b) => b.attainment - a.attainment),
      };
    })
    .sort((a, b) => b.payout - a.payout);
}
