// Maps rules-engine records (`GET /v1/rules`) onto the Programme shape the
// programmes list renders. The engine record only carries a subset of the rich
// Programme model, so fields it doesn't provide (segment, geography) fall back to
// neutral defaults. The role IS recovered from the rule via rolesFromRule — the
// same source the edit/clone wizard reads — so the list's role column + filter
// reflect the real audience instead of a guess.
//
// The engine stores ONE RULE PER KPI, so a 5-KPI programme comes back as 5
// records. `rulesToProgrammes` groups them back into one Programme per programme
// (see programmeKey) and aggregates across the group — the list renders one row,
// with the KPI breakdown and the summed max payout. Use it, not the per-rule
// `ruleToProgramme`, wherever a list of rules is displayed.

import type {
  Channel, Programme, ProgrammeKpiSummary, ProgrammeStatus,
} from "@/types/programme";
import type { RuleRecord } from "./ruleApi";
import { rolesFromRule } from "./ruleToBuilder";

// Associates each mapped Programme with the source rules it was built from — one
// per KPI — so clone/edit can rebuild the full wizard state from them (the
// Programme itself is a lossy summary).
//
// Keyed by the stable programme id, NOT by object identity. React Query's
// structuralSharing replaces the Programme objects this module creates with
// merged COPIES on refetch (e.g. after publishing a new programme), so a
// WeakMap<Programme, …> would miss for exactly those rows — sending edit/clone
// down the lossy programmeToBuilder path (empty KPIs, a guessed role). Looking
// up by id survives that substitution.
const SOURCE_RULES = new Map<string, RuleRecord[]>();

/** Every rules-engine record behind a listed Programme — one per KPI, in order. */
export function getSourceRules(programme: Programme): RuleRecord[] {
  return (programme.id ? SOURCE_RULES.get(programme.id) : undefined) ?? [];
}

/** The first source rule — the one carrying the programme-level fields. */
export function getSourceRule(programme: Programme): RuleRecord | undefined {
  return getSourceRules(programme)[0];
}

const STATUSES: ProgrammeStatus[] = ["draft", "active", "locked", "archived", "inactive"];

/**
 * Engine status strings that have no 1:1 programme status. Publishing sends
 * `status: "APPROVED"`, which means the rule is live — so it reads as Active
 * here (and the list derives "Scheduled" from a future start period).
 */
const STATUS_ALIASES: Record<string, ProgrammeStatus> = {
  approved: "active",
  published: "active",
  expired: "archived",
  completed: "archived",
};

function toStatus(raw: string | undefined, isActive: boolean | undefined): ProgrammeStatus {
  // isActive is the authoritative "turned off" flag, so it wins over the raw
  // status string — a rule can come back as status:"DRAFT" + isActive:false and
  // must still surface under the Archived filter, not Draft.
  if (isActive === false) return "inactive";
  const s = (raw ?? "").toLowerCase();
  if ((STATUSES as string[]).includes(s)) return s as ProgrammeStatus;
  return STATUS_ALIASES[s] ?? "draft";
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
  // Grouped shape: the division is written as `salesOrg` on user_filters (see
  // buildRulePayloads). `outletDivision` / `division` are older field names kept
  // for rules created before that — check all three.
  const groupRules = [...(c?.outlet_filters?.rules ?? []), ...(c?.user_filters?.rules ?? [])];
  const fromGroup = groupRules.find(
    (r) => r?.field === "salesOrg" || r?.field === "outletDivision" || r?.field === "division",
  )?.value;
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

/**
 * This rule's own max payout — one KPI's worth. Read straight off the payload:
 * `maxEarning` is written from the KPI template's own maxPayout(config) (cap
 * extension folded in), so it is the authoritative figure.
 *
 * Deriving it from the tiers instead is wrong for per-unit curves: a per-line or
 * per-outlet rule stores each band's RATE in payoutValue (₹1/line, ₹2/outlet)
 * rather than a cumulative payout, so scanning tiers reported the rate (₹1, ₹2)
 * as the max. Only true % step-ups accumulate. Rules with no maxEarning report 0.
 */
function ruleMaxEarning(rule: RuleRecord): number {
  return rule.ruleDefinition?.maxEarning ?? 0;
}

export function ruleToProgramme(rule: RuleRecord): Programme {
  const maxMonthlyEarning = ruleMaxEarning(rule);

  const programme: Programme = {
    id: rule.id ?? rule.ruleId ?? rule.ruleCode ?? "",
    name: rule.ruleName || rule.ruleCode || "Untitled programme",
    status: toStatus(rule.status, rule.isActive),
    channel: extractDivision(rule.applicabilityCriteria) ?? "CCD",
    role: rolesFromRule(rule)[0] ?? "",
    segment: "all",
    geography: "all-india",
    period: periodFromIso(rule.effectiveFrom),
    programId: rule.programId,
    effectiveFrom: rule.effectiveFrom,
    effectiveTill: rule.effectiveTill,
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
  if (programme.id) SOURCE_RULES.set(programme.id, [rule]);
  return programme;
}

/**
 * The programme a rule belongs to. `programId` is stamped on every rule of a
 * programme at publish time (see rulePayload), so it's the real key. Rules saved
 * before it existed fall back to name + effective window — each KPI's rule shares
 * both — which can only over-merge two same-named programmes over the identical
 * window, and never splits one programme apart.
 */
function programmeKey(rule: RuleRecord): string {
  if (rule.programId) return `pid:${rule.programId}`;
  return `legacy:${rule.ruleName ?? ""}|${rule.effectiveFrom ?? ""}|${rule.effectiveTill ?? ""}`;
}

/** One KPI summary from the rule that scores it. */
function kpiSummaryOf(rule: RuleRecord): ProgrammeKpiSummary {
  const rd = rule.ruleDefinition;
  return {
    ruleId: rule.id ?? rule.ruleId ?? rule.ruleCode ?? "",
    templateId: rd?.kpiId,
    // kpiName is what the builder showed; fall back to the engine code, then the rule.
    name: rd?.kpiName || rd?.kpiCode || rule.kpiCombination || "KPI",
    maxEarning: ruleMaxEarning(rule),
  };
}

/**
 * Merge one programme's rules (one per KPI) into a single Programme row.
 *
 * Programme-level fields — name, status, audience, period, window, gates — are
 * identical across the group (they're built once per programme at publish time),
 * so they come from the first rule. Only the KPI-derived numbers aggregate: the
 * max payout is the SUM across KPIs, and each rule contributes one KPI summary.
 */
function mergeProgrammeRules(rules: RuleRecord[]): Programme {
  const programme = ruleToProgramme(rules[0]);
  const kpiSummaries = rules.map(kpiSummaryOf);
  const merged: Programme = {
    ...programme,
    ruleIds: kpiSummaries.map((k) => k.ruleId).filter(Boolean),
    kpiSummaries,
    maxMonthlyEarning: kpiSummaries.reduce((sum, k) => sum + k.maxEarning, 0),
  };
  // Register every rule of the programme so edit / clone rebuild all its KPIs and
  // archive can end all of them (ruleToProgramme above registered only the first).
  if (merged.id) SOURCE_RULES.set(merged.id, rules);
  return merged;
}

/**
 * Group the engine's per-KPI rules into one Programme per programme, preserving
 * the order in which each programme first appears.
 */
export function rulesToProgrammes(rules: RuleRecord[]): Programme[] {
  const groups = new Map<string, RuleRecord[]>();
  for (const rule of rules) {
    const key = programmeKey(rule);
    const group = groups.get(key);
    if (group) group.push(rule);
    else groups.set(key, [rule]);
  }
  return [...groups.values()].map(mergeProgrammeRules);
}
