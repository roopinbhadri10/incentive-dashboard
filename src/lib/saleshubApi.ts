// SalesHub API client — fetches master data from api.salescodeai.com.
//
// Override via env vars:
//   VITE_SALESHUB_BASE_URL  — defaults to https://api.salescodeai.com
//   VITE_SALESHUB_TOKEN     — Bearer token for Authorization header
//   VITE_SALESHUB_TENANT_ID — value for X-Tenant-Id header

const SALESHUB_BASE_URL =
  import.meta.env.VITE_SALESHUB_BASE_URL ?? "https://api.salescodeai.com";

const SALESHUB_TOKEN =
  import.meta.env.VITE_SALESHUB_TOKEN ??
  // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzYWxlc2RiLWF1dGgiLCJpYXQiOjE3ODE0OTc4MTYsImV4cCI6MTc4MTUzMzgxNiwidGVuYW50X2lkIjoienlkdXMiLCJ1c2VyX2lkIjo3MDU0MDMsInVzZXJuYW1lIjoic2FsZXNodWJAc2FsZXNjb2RlLmFpIiwib3JnX3R5cGUiOm51bGwsIm9yZ19jb2RlIjpudWxsLCJkZWZhdWx0X2NyZWRzIjp0cnVlLCJyb2xlcyI6WyJURU5BTlRfQURNSU4iXSwianRpIjoiM2EzYmI3OTgtMmZhZS00NTliLWFmY2ItMzU5ZGYxZWM1YzE4In0.XGANvNGlQl73vfUepH1tY3zqsKeH8V1RDaEBYkPjhPc"
 "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzYWxlc2RiLWF1dGgiLCJpYXQiOjE3ODE0OTc4NDYsImV4cCI6MTc4MTUzMzg0NiwidGVuYW50X2lkIjoiRW1hbWkiLCJ1c2VyX2lkIjoxNDcwNzgsInVzZXJuYW1lIjoiRW1hbWkiLCJvcmdfdHlwZSI6bnVsbCwib3JnX2NvZGUiOm51bGwsImRlZmF1bHRfY3JlZHMiOnRydWUsInJvbGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJqdGkiOiJmNDVmYzliNS01NDkzLTQxNTEtYmU5Mi0xZDNjZDA2ODhiNDMifQ.DB29Yz4gmDPUyW64s_5c2j1Ayc2Qijm5Sjn0EY14v-w"
const SALESHUB_TENANT_ID =
  import.meta.env.VITE_SALESHUB_TENANT_ID ?? 
  // "zydus"
  "Emami";

function saleshubHeaders(): HeadersInit {
  return {
    accept: "application/json, text/plain, */*",
    authorization: `Bearer ${SALESHUB_TOKEN}`,
    "x-tenant-id": SALESHUB_TENANT_ID,
  };
}

export interface OutletChannelStat {
  channel: string;
  count: number;
}

export interface OutletStats {
  total: number;
  active: number;
  inactive: number;
  byChannel: OutletChannelStat[];
}

/** Fetch outlet stats including channel breakdown. */
export async function fetchOutletStats(): Promise<OutletStats> {
  const res = await fetch(`${SALESHUB_BASE_URL}/outlets/stats`, {
    headers: saleshubHeaders(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SalesHub /outlets/stats responded ${res.status}${detail ? `: ${detail}` : ""}`
    );
  }

  return res.json() as Promise<OutletStats>;
}

/**
 * Fetch channel names from outlet stats. If the API call fails (token expired,
 * network, etc.) we return an empty list so the picker shows no options rather
 * than the raw API error.
 */
export async function fetchChannelNames(): Promise<string[]> {
  try {
    const stats = await fetchOutletStats();
    return stats.byChannel.map((c) => c.channel);
  } catch (err) {
    console.warn("fetchChannelNames: API failed, returning no channels —", err);
    return [];
  }
}

// Roles come from the org-types hierarchy. Each org type is a node in the org
// tree (e.g. ZSM → RSM → ASM → HQ → ASO → DB → MR → OUTLET); its `code` is the
// role identifier and `description` the human-readable label.
export interface SaleshubRole {
  id: number;
  tenantId: string;
  code: string;
  type: string;
  description: string | null;
  isBuiltin: boolean;
  parents: string[];
  createdAt: string;
}

/** Fetch all org-type roles for the configured tenant, sorted by code. */
export async function fetchRoles(): Promise<SaleshubRole[]> {
  const res = await fetch(`${SALESHUB_BASE_URL}/org-types`, {
    headers: saleshubHeaders(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SalesHub /org-types responded ${res.status}${detail ? `: ${detail}` : ""}`
    );
  }

  const data = await res.json();
  const roles: SaleshubRole[] = Array.isArray(data) ? data : [];
  return roles.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Convenience — returns just the role codes. If the live API call fails (token
 * expired, network, etc.) we return an empty list so the role picker shows no
 * options rather than the raw API error.
 */
export async function fetchRoleNames(): Promise<string[]> {
  try {
    const roles = await fetchRoles();
    return roles.map((r) => r.code);
  } catch (err) {
    console.warn("fetchRoleNames: API failed, returning no roles —", err);
    return [];
  }
}

// ── Geography / location master data ─────────────────────────────────────────
//
// SalesHub models locations as a hierarchy described by /org/location-defs:
//   1 COUNTRY · 2 REGION · 3 STATE · 4 DISTRICT · 5 CITY
// The incentive audience picker is a 3-level Zone → State → City cascade. We map
// it onto the API as Region (zone) → State → District (city), which is exactly
// what a single /org/locations/tree?parent=<region> call returns per region.

const REGION_LEVEL = 2;

export interface SaleshubLocation {
  id: number;
  tenantId: string;
  code: string;
  name: string;
  level: string;
  parentCode: string | null;
  active: boolean;
}

/** Fetch raw locations, optionally filtered to a single hierarchy level. */
export async function fetchLocations(
  opts: { level?: number | string; limit?: number; offset?: number } = {}
): Promise<SaleshubLocation[]> {
  const { level, limit = 500, offset = 0 } = opts;
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (level !== undefined) qs.set("level", String(level));

  const res = await fetch(`${SALESHUB_BASE_URL}/org/locations?${qs}`, {
    headers: saleshubHeaders(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SalesHub /org/locations responded ${res.status}${detail ? `: ${detail}` : ""}`
    );
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export interface LocationTreeNode {
  code: string;
  name: string;
  level: string;
  parentCode: string | null;
  parentLevel: string | null;
  active: boolean;
  childCount: number;
  children: LocationTreeNode[];
}

/** Fetch the location subtree rooted at the given parent code. */
export async function fetchLocationTree(parentCode: string): Promise<LocationTreeNode[]> {
  const res = await fetch(
    `${SALESHUB_BASE_URL}/org/locations/tree?parent=${encodeURIComponent(parentCode)}`,
    { headers: saleshubHeaders() }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SalesHub /org/locations/tree responded ${res.status}${detail ? `: ${detail}` : ""}`
    );
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ── Config / feature master data ─────────────────────────────────────────────
//
// Tenant-level UI configuration lives in the incentive config service, each
// config scoped by a (domainName, domainType) pair and carrying a `domainValue`
// payload. The incentive builder reads several such configs (gate metric
// groups, consequence options, …) from the /ui-configs endpoint, which returns
// a single config object per (domainName, domainType). Responses are cached for
// the session so each config is fetched at most once.
//
// Override the config service base URL via VITE_INCENTIVE_CONFIG_BASE_URL.

const INCENTIVE_CONFIG_BASE_URL =
  import.meta.env.VITE_INCENTIVE_CONFIG_BASE_URL ??
  "https://incentive-uat.salescode.ai/v1";

const CONFIG_ENDPOINT = "/ui-configs";

/** A single configuration object, scoped by (domainName, domainType). */
export interface ConfigFeature<TValue = unknown> {
  id?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  creationTime?: string | null;
  lastUpdateTime?: string | null;
  domainName: string;
  domainType: string;
  domainValue: TValue;
}

/** Metric groups for gate rules, keyed by group name → list of metric labels. */
export type MetricGroups = Record<string, string[]>;

// Domain coordinates for the gate-rule metric groups config.
export const METRIC_GROUPS_DOMAIN_NAME = "incentiveconfig";
export const METRIC_GROUPS_DOMAIN_TYPE = "gate_rule_metric_group_configuration";

/**
 * A gate-rule consequence option (a radio choice in the picker). `kind` matches
 * the GateConsequence union; `label` is the display text and may contain
 * `{percent}` / `{scope}` tokens (the "reduce" kind splices inputs into those).
 */
export interface ConsequenceOption {
  kind: "zero-all" | "zero-kpis" | "reduce" | "custom";
  label: string;
}
export type ConsequenceOptions = ConsequenceOption[];

/** domainValue shape for the consequence-options config. */
export interface ConsequenceConfigValue {
  options: ConsequenceOption[];
}

// Domain coordinates for the gate-rule consequence options config.
export const CONSEQUENCE_DOMAIN_NAME = "incentiveconfig";
export const CONSEQUENCE_DOMAIN_TYPE = "gate_rule_consequence_configuration";

// Domain coordinates for the selectable programme roles config.
export const ROLES_DOMAIN_NAME = "incentiveconfig";
export const ROLES_DOMAIN_TYPE = "role_configuration";

// Domain coordinates for the role → API value (marketType) mapping config.
export const ROLE_PAYLOAD_VALUE_DOMAIN_NAME = "incentiveconfig";
export const ROLE_PAYLOAD_VALUE_DOMAIN_TYPE = "role_payload_value_configuration";

// Domain coordinates for the role → user_filters designation mapping config.
export const ROLE_DESIGNATION_DOMAIN_NAME = "incentiveconfig";
export const ROLE_DESIGNATION_DOMAIN_TYPE = "role_designation_configuration";

/** domainValue shape for the roles config. */
export interface RolesConfigValue {
  roles: string[];
}

/** domainValue shape for the role → API value mapping config. */
export type RolePayloadValues = Record<string, string>;

/** domainValue shape for the role → designation mapping config. */
export type RoleDesignationValues = Record<string, string>;

// Session cache: (domainName::domainType) → in-flight or resolved config.
const configCache = new Map<string, Promise<ConfigFeature | null>>();

/**
 * Fetch the configuration object for a (domainName, domainType) pair from the
 * /ui-configs endpoint. Successful results are cached for the session — the
 * first call hits the API, subsequent calls reuse the same promise. Returns
 * null if the config is missing or the API call fails; a *failure* is NOT
 * cached — the entry is evicted so the next call retries. (Otherwise a single
 * transient failure on cold load — e.g. before auth is ready — would poison the
 * cache for the whole session, leaving roles / KPI catalog / channels empty
 * until a hard refresh.)
 */
export async function fetchConfigFeature<TValue = unknown>(
  domainName: string,
  domainType: string
): Promise<ConfigFeature<TValue> | null> {
  const key = `${domainName}::${domainType}`;
  const cached = configCache.get(key);
  if (cached) return cached as Promise<ConfigFeature<TValue> | null>;

  const load = (async (): Promise<ConfigFeature | null> => {
    const qs = new URLSearchParams({ domainName, domainType });
    try {
      const res = await fetch(
        `${INCENTIVE_CONFIG_BASE_URL}${CONFIG_ENDPOINT}?${qs}`,
        { headers: { accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`config responded ${res.status}`);
      return (await res.json()) as ConfigFeature;
    } catch (err) {
      console.warn(`fetchConfigFeature(${key}): API failed —`, err);
      // Evict so a transient failure doesn't stick for the rest of the session.
      configCache.delete(key);
      return null;
    }
  })();

  configCache.set(key, load);
  return load as Promise<ConfigFeature<TValue> | null>;
}

/**
 * Fetch the gate-rule metric groups from config. Returns the config's
 * domainValue object, or {} if none is configured / the API call fails.
 */
export async function fetchMetricGroups(): Promise<MetricGroups> {
  const config = await fetchConfigFeature<MetricGroups>(
    METRIC_GROUPS_DOMAIN_NAME,
    METRIC_GROUPS_DOMAIN_TYPE
  );
  const values = config?.domainValue;
  return values && typeof values === "object" ? values : {};
}

/**
 * Fetch the gate-rule consequence options from config. Returns the config's
 * domainValue.options array, or [] if none is configured / the API call fails.
 */
export async function fetchConsequenceOptions(): Promise<ConsequenceOptions> {
  const config = await fetchConfigFeature<ConsequenceConfigValue>(
    CONSEQUENCE_DOMAIN_NAME,
    CONSEQUENCE_DOMAIN_TYPE
  );
  const options = config?.domainValue?.options;
  return Array.isArray(options) ? options : [];
}

/**
 * Fetch the selectable programme roles from config. Returns the config's
 * domainValue.roles array, or [] if none is configured / the API call fails.
 */
export async function fetchProgramRoles(): Promise<string[]> {
  const config = await fetchConfigFeature<RolesConfigValue>(
    ROLES_DOMAIN_NAME,
    ROLES_DOMAIN_TYPE
  );
  const roles = config?.domainValue?.roles;
  return Array.isArray(roles) ? roles : [];
}

// Synchronous mirror of the last-fetched role → API value mapping, so payload
// building (which is synchronous) can resolve values without awaiting. Warmed
// by fetchRolePayloadValues().
let rolePayloadValuesCache: RolePayloadValues = {};

/**
 * Fetch the role → API value (outlet_type) mapping from config. Returns the
 * config's domainValue object, or {} if none is configured / the API call
 * fails. Also warms the synchronous cache read by getRolePayloadValue().
 */
export async function fetchRolePayloadValues(): Promise<RolePayloadValues> {
  const config = await fetchConfigFeature<RolePayloadValues>(
    ROLE_PAYLOAD_VALUE_DOMAIN_NAME,
    ROLE_PAYLOAD_VALUE_DOMAIN_TYPE
  );
  const values = config?.domainValue;
  rolePayloadValuesCache = values && typeof values === "object" ? values : {};
  return rolePayloadValuesCache;
}

/**
 * Synchronous lookup of a role's API value from the last fetched mapping.
 * Returns "" if the role is unknown or the mapping hasn't loaded yet.
 */
export function getRolePayloadValue(role: string): string {
  return rolePayloadValuesCache[role] ?? "";
}

/**
 * Reverse of getRolePayloadValue: recover the role from its API value
 * (marketType, e.g. "URBAN" → "Urban MR"). This mapping is 1:1, so it gives the
 * EXACT role — unlike the designation mapping, where every MR role collapses to
 * "mr". Used on edit/clone to rebuild the audience role from the rule's
 * outlet_filters when the verbatim kpiConfig.userFilters.roles wasn't preserved
 * by the engine. Returns "" if unknown or the mapping hasn't loaded yet.
 */
export function getRoleByPayloadValue(marketType: string): string {
  if (!marketType) return "";
  for (const [role, value] of Object.entries(rolePayloadValuesCache)) {
    if (value === marketType) return role;
  }
  return "";
}

// Synchronous mirror of the last-fetched role → designation mapping, so payload
// building (which is synchronous) can resolve values without awaiting. Warmed
// by fetchRoleDesignations().
let roleDesignationsCache: RoleDesignationValues = {};

/**
 * Fetch the role → user_filters designation mapping from config. Returns the
 * config's domainValue object, or {} if none is configured / the API call
 * fails. Also warms the synchronous cache read by getRoleDesignation().
 */
export async function fetchRoleDesignations(): Promise<RoleDesignationValues> {
  const config = await fetchConfigFeature<RoleDesignationValues>(
    ROLE_DESIGNATION_DOMAIN_NAME,
    ROLE_DESIGNATION_DOMAIN_TYPE
  );
  const values = config?.domainValue;
  roleDesignationsCache = values && typeof values === "object" ? values : {};
  return roleDesignationsCache;
}

/**
 * Synchronous lookup of a role's designation from the last fetched mapping.
 * Returns "" if the role is unknown or the mapping hasn't loaded yet.
 */
export function getRoleDesignation(role: string): string {
  return roleDesignationsCache[role] ?? "";
}

/**
 * Reverse of getRoleDesignation: recover the role from its designation. The
 * forward mapping is many-to-one (e.g. Urban/Rural/Hybrid MR all → "mr"), so
 * the reverse is only meaningful when exactly ONE role maps to the designation —
 * otherwise we'd guess the wrong role. Returns "" when ambiguous, unknown, or
 * the mapping hasn't loaded yet. Used as a last resort on edit/clone, after the
 * exact sources (kpiConfig roles, marketType) have been tried.
 */
export function getRoleByDesignation(designation: string): string {
  if (!designation) return "";
  const matches = Object.entries(roleDesignationsCache)
    .filter(([, value]) => value === designation)
    .map(([role]) => role);
  return matches.length === 1 ? matches[0] : "";
}

/** Zone → State → City tree, keyed by display name (matches the picker's shape). */
export type GeographyTree = Record<string, Record<string, string[]>>;

/**
 * Build the Zone → State → City geography tree from SalesHub master data.
 * Regions (level 2) become zones; each region's subtree supplies its states
 * (level 3) and their districts (level 4) as the selectable "cities".
 *
 * If the API call fails (token expired, network, etc.) we return an empty tree
 * so the picker shows no options rather than the raw API error.
 */
export async function fetchGeographyTree(): Promise<GeographyTree> {
  let regions: SaleshubLocation[];
  try {
    regions = (await fetchLocations({ level: REGION_LEVEL })).filter(
      (l) => String(l.level) === String(REGION_LEVEL) && l.active
    );
  } catch (err) {
    console.warn("fetchGeographyTree: API failed, returning empty tree —", err);
    return {};
  }

  const tree: GeographyTree = {};
  await Promise.all(
    regions.map(async (region) => {
      const states: Record<string, string[]> = {};
      const nodes = await fetchLocationTree(region.code).catch(
        () => [] as LocationTreeNode[]
      );
      for (const stateNode of nodes) {
        if (stateNode.active === false) continue;
        states[stateNode.name] = (stateNode.children ?? [])
          .filter((d) => d.active !== false)
          .map((d) => d.name);
      }
      tree[region.name] = states;
    })
  );
  return tree;
}
