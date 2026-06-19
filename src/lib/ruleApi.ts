// Thin client for the incentive rules engine (`GET` / `POST /v1/rules`).
//
// In dev the default endpoint is a relative path proxied by Vite to
// https://incentive-uat.salescode.ai (see `server.proxy` in vite.config.ts),
// which avoids browser CORS errors. Override the endpoint / tenant for other
// environments with VITE_RULES_ENDPOINT and VITE_TENANT_ID.

import type { RuleApiPayload } from "./rulePayload";

const RULES_ENDPOINT = import.meta.env.VITE_RULES_ENDPOINT ?? "/incentive-api/v1/rules";
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? "default";

export async function submitRule(payload: RuleApiPayload): Promise<unknown> {
  // const RULES_ENDPOINT=import.meta.env.VITE_RULES_ENDPOINT ?? "/incentive-api/v1/ruless";
  const res = await fetch(RULES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT_ID,
    },
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
 * Archive (delete) a rule by id — `DELETE /v1/rules/{id}`.
 * The engine returns 204/200 with no meaningful body on success.
 */
export async function archiveRule(id: string): Promise<void> {
  if (!id) throw new Error("Cannot archive a rule without an id.");
  const res = await fetch(`${RULES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "X-Tenant-Id": TENANT_ID,
    },
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
  // New shape carries `hurdle`; legacy rules carry `minAchievementPct`.
  kpiConditions?: { minAchievementPct?: number; hurdle?: { date?: string; required_percentage?: number } };
  ruleDefinition?: {
    kpiCode?: string;
    payoutType?: string;
    stepUpBy1Percent?: boolean;
    startingEarning?: number;
    keyRules?: string[];
    cutOfDate?: string;
    // New tiers use {min, payoutValue[, payoutType]}; legacy use {minVal, maxVal, payout}.
    tiers?: Array<{
      min?: number;
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
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT_ID,
    },
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
