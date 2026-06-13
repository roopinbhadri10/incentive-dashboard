// Field extractors for the Reports & Dumps page.
// Centralises the per-KPI logic so the dump and achievement report
// never drift from the wizard's own slab math.

import type { SavedProgram, SavedProgramKpi } from "@/lib/programStore";
import { KPI_TEMPLATE_MAP, kpiDisplayName, type KpiTemplateId } from "@/components/kpi-library/registry";
import { computeSlabEarnings, type NsvTemplateConfig } from "@/components/kpi-library/nsvTypes";
import {
  simpleSlabMaxPayout,
  type EcoConfig, type LinesConfig, type SimpleSlabConfig,
} from "@/components/kpi-library/kpiConfigTypes";
import { batchesForRole, type UserListUser } from "@/lib/userListsStore";

// ─── Seeded RNG (stable across downloads) ─────────────────────────────────
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ─── Synthetic user generator (fallback when no upload exists) ────────────
const REGIONS = ["North", "South", "East", "West", "Central"];
const STATES = ["Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Delhi", "UP", "Kerala", "Punjab"];
const CITIES = ["Mumbai", "Bengaluru", "Chennai", "Ahmedabad", "Delhi", "Lucknow", "Kochi", "Pune"];
const FIRST = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anjali", "Suresh", "Neha", "Karan", "Pooja", "Rohit", "Divya", "Manish", "Kavita", "Arjun"];
const LAST = ["Sharma", "Patel", "Reddy", "Iyer", "Singh", "Kumar", "Nair", "Mehta", "Gupta", "Joshi"];

export function syntheticUsers(program: SavedProgram, count = 12): UserListUser[] {
  const r = makeRng(hashSeed(program.id));
  const isKerala = /kerala/i.test(program.role);
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.floor(r() * FIRST.length);
    const lidx = Math.floor(r() * LAST.length);
    const region = isKerala ? "South" : REGIONS[Math.floor(r() * REGIONS.length)];
    const state = isKerala ? "Kerala" : STATES[Math.floor(r() * STATES.length)];
    const city = isKerala
      ? ["Kochi", "Trivandrum", "Calicut", "Thrissur"][Math.floor(r() * 4)]
      : CITIES[Math.floor(r() * CITIES.length)];
    return {
      empId: `EMP${(10000 + Math.floor(r() * 89999)).toString()}`,
      name: `${FIRST[idx]} ${LAST[lidx]}`,
      email: `${FIRST[idx].toLowerCase()}.${LAST[lidx].toLowerCase()}${i}@salescode.ai`,
      region,
      state,
      city,
      reportingManager: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
      joinDate: `2023-${String(Math.floor(r() * 12) + 1).padStart(2, "0")}-${String(Math.floor(r() * 28) + 1).padStart(2, "0")}`,
      active: true,
    };
  });
}

/** Resolve users for a program: uploaded list first, synthetic fallback. */
export function usersForProgram(program: SavedProgram): UserListUser[] {
  const batches = batchesForRole(program.role);
  const fromUpload = batches.flatMap((b) => b.users);
  if (fromUpload.length > 0) return fromUpload;
  return syntheticUsers(program);
}

// ─── KPI config description ────────────────────────────────────────────────

export interface KpiTargetInfo {
  name: string;
  category: string;
  basis: string;
  target: string;
  slabs: string;
  maxPayout: number;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function describeKpi(kpi: SavedProgramKpi): KpiTargetInfo {
  const tpl = KPI_TEMPLATE_MAP[kpi.templateId as KpiTemplateId];
  const name = kpiDisplayName(kpi.templateId as KpiTemplateId, kpi.customName);
  const category = tpl?.tag ?? "—";
  const maxPayout = Math.round(tpl?.maxPayout(kpi.config) ?? 0);

  switch (kpi.templateId) {
    case "nsv":
    case "phasing":
    case "qnsv": {
      const c = kpi.config as NsvTemplateConfig & { cutoffDay?: number };
      const slabs = (c.slabs ?? [])
        .map((s) => `${s.pct}%→${inr(s.entryPayout ?? s.ratePerPct)}`)
        .join(" | ");
      const basis = kpi.templateId === "phasing"
        ? `${c.basis} (cut-off day ${c.cutoffDay ?? "—"})`
        : (c.basis ?? "secondary");
      return {
        name, category, basis,
        target: "Per-user system target",
        slabs,
        maxPayout,
      };
    }
    case "eco": {
      const c = kpi.config as EcoConfig;
      if (c.role === "aso_ase") {
        return { name, category, basis: "ASO/ASE downline avg", target: "—", slabs: `${c.rateMultiplier} × Avg MR earning`, maxPayout };
      }
      const slabs = (c.slabs ?? []).map((s) => `${s.count} outlets@₹${s.ratePerOutlet}/outlet`).join(" | ");
      const topCount = c.slabs?.length ? c.slabs[c.slabs.length - 1].count : 0;
      return {
        name, category,
        basis: c.minBillEnabled ? `Min ₹${c.minBillAmount} GSV/bill` : "Any non-zero billing",
        target: `${topCount} outlets`,
        slabs,
        maxPayout,
      };
    }
    case "tlsd":
    case "dbb": {
      const c = kpi.config as LinesConfig;
      if (c.role === "aso_ase") {
        return { name, category, basis: kpi.templateId === "dbb" ? "Focus SKU list" : "Unique lines @ CRS group", target: "—", slabs: `${c.rateMultiplier} × Avg MR earning`, maxPayout };
      }
      return {
        name, category,
        basis: kpi.templateId === "dbb" ? "Focus SKU list" : "Unique lines @ CRS group",
        target: `${c.minLines}–${c.maxLines} lines`,
        slabs: `₹${c.ratePerLine}/line above ${c.minLines}, capped at ${c.maxLines}`,
        maxPayout,
      };
    }
    default: {
      const c = kpi.config as SimpleSlabConfig;
      const slabs = (c.slabs ?? [])
        .map((s) => `${s.threshold}${c.unit === "pct" ? "%" : ""}→${inr(s.payout)}`)
        .join(" | ");
      const top = c.slabs?.length ? c.slabs[c.slabs.length - 1] : null;
      return {
        name, category,
        basis: category,
        target: top ? `${top.threshold}${c.unit === "pct" ? "%" : ` ${c.unit}`}` : "—",
        slabs,
        maxPayout: top ? simpleSlabMaxPayout(c) : 0,
      };
    }
  }
}

// ─── Achievement synthesis (per-template, deterministic) ───────────────────

export interface AchievementInfo {
  actual: string;
  achievementPct: number; // 0-130
  slabAchieved: string;
  earnedPayout: number;
  utilizationPct: number;
}

export function computeAchievement(
  program: SavedProgram,
  user: UserListUser,
  kpi: SavedProgramKpi,
): AchievementInfo {
  const seed = hashSeed(`${program.id}|${user.empId}|${kpi.instanceId}`);
  const rng = makeRng(seed);
  const info = describeKpi(kpi);
  const maxPayout = info.maxPayout;

  switch (kpi.templateId) {
    case "nsv":
    case "phasing":
    case "qnsv": {
      const c = kpi.config as NsvTemplateConfig;
      const achPct = Math.round((60 + rng() * 70) * 10) / 10; // 60–130%
      const earnings = computeSlabEarnings(c.slabs ?? [], c.stepMode ?? "stepup");
      // walk slabs: highest slab whose pct <= achPct
      let earned = 0;
      let slabLabel = "Below entry";
      for (const e of earnings) {
        if (achPct >= e.pct) { earned = e.cumulative; slabLabel = `${e.pct}%`; }
      }
      // partial credit between slabs for stepup mode
      if ((c.stepMode ?? "stepup") === "stepup") {
        for (let i = 0; i < (c.slabs ?? []).length; i++) {
          const s = c.slabs[i];
          if (achPct < s.pct) break;
          if (i + 1 < c.slabs.length && achPct < c.slabs[i + 1].pct) {
            earned = earnings[i].cumulative + (achPct - s.pct) * c.slabs[i + 1].ratePerPct;
            break;
          }
        }
      }
      earned = Math.min(Math.round(earned), maxPayout || earned);
      return {
        actual: `${achPct}% of target`,
        achievementPct: achPct,
        slabAchieved: slabLabel,
        earnedPayout: earned,
        utilizationPct: maxPayout > 0 ? Math.round((earned / maxPayout) * 1000) / 10 : 0,
      };
    }
    case "eco": {
      const c = kpi.config as EcoConfig;
      if (c.role === "aso_ase" || !c.slabs?.length) {
        const earned = Math.round(maxPayout * (0.4 + rng() * 0.7));
        return { actual: "Downline avg", achievementPct: 0, slabAchieved: "—", earnedPayout: earned, utilizationPct: maxPayout > 0 ? Math.round((earned / maxPayout) * 1000) / 10 : 0 };
      }
      const top = c.slabs[c.slabs.length - 1].count;
      const outlets = Math.round(rng() * top * 1.1);
      let cum = 0;
      let slabLabel = "Below entry";
      for (let i = 0; i < c.slabs.length; i++) {
        const prev = i === 0 ? 0 : c.slabs[i - 1].count;
        if (outlets >= c.slabs[i].count) {
          cum += (c.slabs[i].count - prev) * c.slabs[i].ratePerOutlet;
          slabLabel = `${c.slabs[i].count} outlets`;
        } else if (outlets > prev) {
          cum += (outlets - prev) * c.slabs[i].ratePerOutlet;
          slabLabel = `${prev}+ outlets`;
          break;
        }
      }
      const earned = Math.round(cum);
      const achPct = Math.round((outlets / top) * 1000) / 10;
      return {
        actual: `${outlets} outlets`,
        achievementPct: achPct,
        slabAchieved: slabLabel,
        earnedPayout: earned,
        utilizationPct: maxPayout > 0 ? Math.round((earned / maxPayout) * 1000) / 10 : 0,
      };
    }
    case "tlsd":
    case "dbb": {
      const c = kpi.config as LinesConfig;
      if (c.role === "aso_ase") {
        const earned = Math.round(maxPayout * (0.4 + rng() * 0.7));
        return { actual: "Downline avg", achievementPct: 0, slabAchieved: "—", earnedPayout: earned, utilizationPct: maxPayout > 0 ? Math.round((earned / maxPayout) * 1000) / 10 : 0 };
      }
      const lines = Math.round(rng() * c.maxLines * 1.1);
      const billable = Math.max(0, Math.min(lines, c.maxLines) - c.minLines);
      const earned = lines < c.minLines ? 0 : Math.round(billable * c.ratePerLine);
      const achPct = Math.round((lines / c.maxLines) * 1000) / 10;
      return {
        actual: `${lines} lines`,
        achievementPct: achPct,
        slabAchieved: lines < c.minLines ? "Below entry" : `${Math.min(lines, c.maxLines)} lines`,
        earnedPayout: earned,
        utilizationPct: maxPayout > 0 ? Math.round((earned / maxPayout) * 1000) / 10 : 0,
      };
    }
    default: {
      const c = kpi.config as SimpleSlabConfig;
      const slabs = [...(c.slabs ?? [])].sort((a, b) => a.threshold - b.threshold);
      if (!slabs.length) return { actual: "—", achievementPct: 0, slabAchieved: "—", earnedPayout: 0, utilizationPct: 0 };
      const top = slabs[slabs.length - 1].threshold;
      const value = Math.round(rng() * top * 1.1 * 10) / 10;
      let earned = 0;
      let slabLabel = "Below entry";
      for (const s of slabs) {
        if (value >= s.threshold) { earned = s.payout; slabLabel = `${s.threshold}${c.unit === "pct" ? "%" : ""}`; }
      }
      const achPct = Math.round((value / top) * 1000) / 10;
      return {
        actual: c.unit === "pct" ? `${value}%` : `${value} ${c.unit}`,
        achievementPct: achPct,
        slabAchieved: slabLabel,
        earnedPayout: earned,
        utilizationPct: maxPayout > 0 ? Math.round((earned / maxPayout) * 1000) / 10 : 0,
      };
    }
  }
}

export function statusFor(achPct: number): "Achieved" | "On Track" | "At Risk" {
  if (achPct >= 100) return "Achieved";
  if (achPct >= 80) return "On Track";
  return "At Risk";
}

export function describeGates(program: SavedProgram): string {
  if (!program.gates?.length) return "";
  return program.gates
    .map((g) => g.id ?? "Gate")
    .join(" ; ");
}

export function programMaxEarning(program: SavedProgram): number {
  return program.kpis.reduce((acc, k) => acc + describeKpi(k).maxPayout, 0);
}

export function monthYearLabel(p: SavedProgram): string {
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][(p.monthYear?.month ?? 1) - 1];
  return `${m}-${p.monthYear?.year ?? ""}`;
}
