// Maps a rules-engine record (`GET /v1/rules`) onto the Programme shape the
// programmes list renders. The engine record only carries a subset of the rich
// Programme model, so fields it doesn't provide (segment, geography, per-KPI
// breakdown) fall back to neutral defaults. The role IS recovered from the rule
// via rolesFromRule — the same source the edit/clone wizard reads — so the
// list's role column + filter reflect the real audience instead of a guess.

import type { Channel, Programme, ProgrammeStatus } from "@/types/programme";
import type { RuleRecord } from "./ruleApi";
import { rolesFromRule, normalizeRuleTiers } from "./ruleToBuilder";

// Associates each mapped Programme with its source rule so clone/edit can rebuild
// the full wizard state from the rule (the Programme itself is a lossy summary).
//
// Keyed by the stable programme id, NOT by object identity. React Query's
// structuralSharing replaces the Programme objects this module creates with
// merged COPIES on refetch (e.g. after publishing a new programme), so a
// WeakMap<Programme, …> would miss for exactly those rows — sending edit/clone
// down the lossy programmeToBuilder path (empty KPIs, a guessed role). Looking
// up by id survives that substitution.
const SOURCE_RULE = new Map<string, RuleRecord>();

/** The rules-engine record a listed Programme was built from, if available. */
export function getSourceRule(programme: Programme): RuleRecord | undefined {
  return programme.id ? SOURCE_RULE.get(programme.id) : undefined;
}

const STATUSES: ProgrammeStatus[] = ["draft", "active", "locked", "archived", "inactive"];

function toStatus(raw: string | undefined, isActive: boolean | undefined): ProgrammeStatus {
  // isActive is the authoritative "turned off" flag, so it wins over the raw
  // status string — a rule can come back as status:"DRAFT" + isActive:false and
  // must still surface under the Inactive filter, not Draft.
  if (isActive === false) return "inactive";
  const s = (raw ?? "").toLowerCase();
  if ((STATUSES as string[]).includes(s)) return s as ProgrammeStatus;
  return "draft";
}

/** Pull the CCD/HCD division out of any applicabilityCriteria shape, if present. */
function extractDivision(criteria: unknown): Channel | undefined {
  const c = criteria as
    | {
        user_filters?: { rules?: Array<{ field?: string; value?: unknown }> };
        outlet_filters?: { rules?: Array<{ field?: string; value?: unknown }> };
        conditions?: Array<{ property?: string; values?: unknown[] }>;
        divisions?: unknown[];
      }
    | undefined;
  // Grouped shape: division lives in outlet_filters (older rules: user_filters).
  const groupRules = [...(c?.outlet_filters?.rules ?? []), ...(c?.user_filters?.rules ?? [])];
  const fromGroup = groupRules.find((r) => r?.field === "outletDivision" || r?.field === "division")?.value;
  const fromGroupVal = Array.isArray(fromGroup) ? fromGroup[0] : fromGroup;
  const fromCondition = c?.conditions?.find((x) => x?.property === "division")?.values?.[0];
  const v = (fromGroupVal ?? fromCondition ?? c?.divisions?.[0]) as string | undefined;
  return v === "CCD" || v === "HCD" ? v : undefined;
}

function periodFromIso(iso: string | undefined): { month: number; year: number; isQ1: boolean } {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  const now = new Date();
  const year = m ? Number(m[1]) : now.getFullYear();
  const month = m ? Number(m[2]) : now.getMonth() + 1;
  return { month, year, isQ1: month >= 1 && month <= 3 };
}

export function ruleToProgramme(rule: RuleRecord): Programme {
  // Normalize to the cumulative tier shape so the top tier reflects the real
  // max earning whether the rule uses the new {min,payoutValue} format or legacy.
  const tiers = normalizeRuleTiers(rule.ruleDefinition);
  const maxMonthlyEarning = tiers.reduce((max, t) => Math.max(max, t?.payout ?? 0), 0);

  const programme: Programme = {
    id: rule.id ?? rule.ruleId ?? rule.ruleCode ?? "",
    name: rule.ruleName || rule.ruleCode || "Untitled programme",
    status: toStatus(rule.status, rule.isActive),
    channel: extractDivision(rule.applicabilityCriteria) ?? "CCD",
    role: rolesFromRule(rule)[0] ?? "",
    segment: "all",
    geography: "all-india",
    period: periodFromIso(rule.effectiveFrom),
    kpis: {},
    gates: {
      // Current rules carry gates under `gateConditions` (first % gate's threshold);
      // legacy rules under `kpiConditions` (hurdle / minAchievementPct).
      nsvMinPct:
        rule.gateConditions?.find((g) => g.evaluationBasis === "PERCENTAGE")?.threshold ??
        rule.kpiConditions?.hurdle?.required_percentage ??
        rule.kpiConditions?.minAchievementPct ??
        0,
      cftUrbanHrs: 0,
      cftRuralHrs: 0,
      cftMinWorkingDays: 0,
      cftPenaltyPct: 0,
      ecoZeroNetValueExcluded: false,
      ecoDoubleCountsSameDayBilling: false,
      partialMonthProRata: false,
    },
    maxMonthlyEarning,
    createdAt: rule.creationTime ?? "",
    updatedAt: rule.lastUpdateTime ?? "",
  };
  if (programme.id) SOURCE_RULE.set(programme.id, rule);
  return programme;
}
