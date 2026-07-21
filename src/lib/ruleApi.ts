// Thin client for the incentive rules engine (`GET` / `POST /v1/rules`).
//
// In dev the default endpoint is a relative path proxied by Vite to
// https://incentive-uat.salescode.ai (see `server.proxy` in vite.config.ts),
// which avoids browser CORS errors. Override the endpoint with
// VITE_RULES_ENDPOINT. Tenant + auth come from the parent portal (config/auth).

import type { RuleApiPayload } from "./rulePayload";
import { getTenantId, getAuthorizationHeader } from "@/config/auth";

const RULES_ENDPOINT = import.meta.env.VITE_RULES_ENDPOINT ?? "/incentive-api/v1/rules";

/**
 * Headers for rules-engine calls. Tenant + auth come from the parent portal
 * (see config/auth). Read per call, never cached at module load, since the
 * cookie may arrive after this module is imported.
 */
function ruleHeaders(withBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    "X-Tenant-Id": getTenantId(),
  };
  if (withBody) headers["Content-Type"] = "application/json";
  const auth = getAuthorizationHeader();
  if (auth) headers["Authorization"] = auth;
  return headers;
}

export async function submitRule(payload: RuleApiPayload): Promise<unknown> {
  const res = await fetch(RULES_ENDPOINT, {
    method: "POST",
    headers: ruleHeaders(true),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Rule API responded ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json().catch(() => ({}));
}

/** Submit several rules in order (one per KPI). Rejects on the first failure. */
export async function submitRules(payloads: RuleApiPayload[]): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const payload of payloads) {
    results.push(await submitRule(payload));
  }
  return results;
}

/**
 * Update an existing rule in place — `PUT /v1/rules/{id}` with the same full body a
 * create POST would send (full replacement, hence PUT rather than PATCH). Used when
 * editing a programme so the edit overwrites the original rule instead of creating a
 * duplicate.
 */
export async function updateRule(id: string, payload: RuleApiPayload): Promise<unknown> {
  if (!id) throw new Error("Cannot update a rule without an id.");
  const res = await fetch(`${RULES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: ruleHeaders(true),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Rule API responded ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * Archive (delete) a rule by id — `DELETE /v1/rules/{id}`.
 * The engine returns 204/200 with no meaningful body on success.
 */
export async function archiveRule(id: string): Promise<void> {
  if (!id) throw new Error("Cannot archive a rule without an id.");
  const res = await fetch(`${RULES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: ruleHeaders(false),
    credentials: "include",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Rule API responded ${res.status}${detail ? `: ${detail}` : ""}`);
  }
}

/** A rule as returned by `GET /v1/rules` — the POST payload plus server-assigned fields. */
export interface RuleRecord {
  id?: string;
  ruleId?: string;
  ruleName?: string;
  ruleCode?: string;
  ruleType?: string;
  calculationFrequency?: string;
  kpiCombination?: string;
  status?: string;
  isActive?: boolean;
  priority?: number;
  effectiveFrom?: string;
  effectiveTill?: string;
  creationTime?: string;
  lastUpdateTime?: string;
  // Legacy gate shape: rules carried a single hurdle under kpiConditions
  // (`hurdle.required_percentage`, older `minAchievementPct`). Current rules carry
  // the richer `gateConditions` array instead (see below).
  kpiConditions?: { minAchievementPct?: number; hurdle?: { date?: string; required_percentage?: number } };
  // Current gate shape — one entry per gate condition. Only the fields the
  // dashboard reads back are typed; the engine returns more (ids, gateKpiConfig).
  gateConditions?: Array<{
    gateKpiCode?: string;
    threshold?: number;
    comparator?: string;
    consequenceType?: string;
    consequenceConfig?: Record<string, unknown>;
    evaluationBasis?: string;
  }>;
  ruleDefinition?: {
    kpiCode?: string;
    payoutType?: string;
    stepUpBy1Percent?: boolean;
    startingEarning?: number;
    keyRules?: string[];
    cutOfDate?: string;
    lineBasedEarning?: boolean;
    // Minimum bill value threshold (eco) / min qty to qualify a line (lines) —
    // emitted only when their toggle is enabled.
    minBillAmount?: number;
    minQtyValue?: number;
    // Cap (max payable achievement / outlets / …) — carried so the editor can
    // restore the cap toggle + value. `value` is the KPI-specific cap amount.
    cap?: { enabled?: boolean; value?: number | null };
    // New tiers use {min, max, payoutType, payoutValue}; legacy use {minVal, maxVal, payout}.
    // `max` is the open end of the top tier (null); older new-shape rules omit it.
    tiers?: Array<{
      min?: number;
      max?: number | null;
      payoutValue?: number;
      payoutType?: string;
      minVal?: number;
      maxVal?: number;
      payout?: number;
    }>;
  };
  applicabilityCriteria?: unknown;
  [key: string]: unknown;
}

/** Fetch all rules. Tolerates a bare array or a `{ data | content | rules }` envelope. */
export async function fetchRules(): Promise<RuleRecord[]> {
  const res = await fetch(RULES_ENDPOINT, {
    headers: ruleHeaders(true),
    credentials: "include",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Rule API responded ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) return data as RuleRecord[];
  const wrapped = data?.data ?? data?.content ?? data?.rules;
  return Array.isArray(wrapped) ? (wrapped as RuleRecord[]) : [];
}
