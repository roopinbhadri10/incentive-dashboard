// SalesHub API client — fetches master data from api.salescodeai.com.
//
// Override via env vars:
//   VITE_SALESHUB_BASE_URL  — defaults to https://api.salescodeai.com
//   VITE_SALESHUB_TOKEN     — Bearer token for Authorization header
//   VITE_SALESHUB_TENANT_ID — value for X-Tenant-Id header

const SALESHUB_BASE_URL =
  import.meta.env.VITE_SALESHUB_BASE_URL ?? "https://api.salescodeai.com";

const SALESHUB_TOKEN =
  import.meta.env.VITE_SALESHUB_TOKEN ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzYWxlc2RiLWF1dGgiLCJpYXQiOjE3ODEzMzA0NzQsImV4cCI6MTc4MTM2NjQ3NCwidGVuYW50X2lkIjoienlkdXMiLCJ1c2VyX2lkIjo3MDU0MDMsInVzZXJuYW1lIjoic2FsZXNodWJAc2FsZXNjb2RlLmFpIiwib3JnX3R5cGUiOm51bGwsIm9yZ19jb2RlIjpudWxsLCJkZWZhdWx0X2NyZWRzIjp0cnVlLCJyb2xlcyI6WyJURU5BTlRfQURNSU4iXSwianRpIjoiNTJjMmVjZDUtNmJhNC00OTEwLWFjN2ItM2UzNjNkMzNlNDBkIn0.k8TXs8mIIp9tLeD8WhPF4J2CoNpSJ8erVLmBBhAOfEs"
  // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzYWxlc2RiLWF1dGgiLCJpYXQiOjE3ODEyNzk3NzYsImV4cCI6MTc4MTMxNTc3NiwidGVuYW50X2lkIjoiRW1hbWkiLCJ1c2VyX2lkIjoxNDcwNzgsInVzZXJuYW1lIjoiRW1hbWkiLCJvcmdfdHlwZSI6bnVsbCwib3JnX2NvZGUiOm51bGwsImRlZmF1bHRfY3JlZHMiOnRydWUsInJvbGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJqdGkiOiJlYTYxOWMxNC00MTQ0LTQxM2EtOWM4Ny0xODJlZDE5MmEzMDIifQ.gpSpEl8-Iq-VaMnIw_TBw3iXtyLuJtnC_kpOjQLKFLc";

const SALESHUB_TENANT_ID =
  import.meta.env.VITE_SALESHUB_TENANT_ID ?? "zydus"
  //"Emami";

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
 * Fetch channel names from outlet stats.
 * Filters out numeric-only and "UNKNOWN" entries that are junk data.
 */
export async function fetchChannelNames(): Promise<string[]> {
  const stats = await fetchOutletStats();
  //  return stats.byChannel
  //   .filter((c) => c.channel && !/^\d+$/.test(c.channel) && c.channel.toUpperCase() !== "UNKNOWN")
  //   .map((c) => c.channel);
   return stats.byChannel.map((c) => c.channel);
}

export interface SaleshubRole {
  id: number;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

/** Fetch all roles for the configured tenant. Returns role names sorted alphabetically. */
export async function fetchRoles(): Promise<SaleshubRole[]> {
  const res = await fetch(`${SALESHUB_BASE_URL}/roles`, {
    headers: saleshubHeaders(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `SalesHub /roles responded ${res.status}${detail ? `: ${detail}` : ""}`
    );
  }

  const data = await res.json();
  const roles: SaleshubRole[] = Array.isArray(data) ? data : [];
  return roles.sort((a, b) => a.name.localeCompare(b.name));
}

/** Convenience — returns just the role name strings. */
export async function fetchRoleNames(): Promise<string[]> {
  const roles = await fetchRoles();
  return roles.map((r) => r.name);
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
// SalesHub stores tenant-level configuration as "features", each scoped by a
// (domainName, domainType) pair and carrying an array of `domainValues`. The
// incentive builder reads several such configs (metric groups, etc.) from this
// single endpoint. Responses are cached per (domainName, domainType) so each
// config is fetched at most once per session.
//
// NOTE: the real config endpoint is not wired up yet, so fetchConfigFeatures
// falls back to a bundled dummy payload (DUMMY_CONFIG) shaped exactly like the
// live API. When the API is ready, point CONFIG_ENDPOINT at it and drop the
// dummy fallback — callers don't change.

const CONFIG_ENDPOINT = "/config/features";

/** A single configuration feature, scoped by (domainName, domainType). */
export interface ConfigFeature<TValue = unknown> {
  createdBy?: string | null;
  modifiedBy?: string | null;
  creationTime?: string | null;
  lastModifiedTime?: string | null;
  lob?: string | null;
  id?: string;
  activeStatus?: string;
  version?: number;
  source?: string | null;
  domainName: string;
  domainType: string;
  description?: string | null;
  domainValues: TValue[];
}

export interface ConfigResponse {
  features: ConfigFeature[];
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

// Domain coordinates for the gate-rule consequence options config.
export const CONSEQUENCE_DOMAIN_NAME = "incentiveconfig";
export const CONSEQUENCE_DOMAIN_TYPE = "gate_rule_consequence_configuration";

// Dummy payload standing in for the live config API, in the exact wire shape.
// Each requested (domainName, domainType) maps to a ConfigResponse.
const DUMMY_CONFIG: ConfigResponse = {
  features: [
    {
      createdBy: "system",
      modifiedBy: "system",
      creationTime: null,
      lastModifiedTime: null,
      lob: null,
      id: "dummy-metric-groups",
      activeStatus: "active",
      version: 1,
      source: null,
      domainName: METRIC_GROUPS_DOMAIN_NAME,
      domainType: METRIC_GROUPS_DOMAIN_TYPE,
      description: "Gate-rule metric groups shown in the condition picker",
      domainValues: [
        {
          attendance: [
            "Attendance %",
            "Absent days",
            "Present days",
            "Working days",
            "Consecutive absent days",
            "Leave without approval",
          ],
          collection: [
            "Collection % of billing",
            "Overdue amount (₹)",
            "Overdue > 30 days %",
            "Overdue > 60 days %",
            "Overdue > 90 days %",
            "Avg. credit days",
            "Cheque bounce count",
          ],
          productivity: [
            "Visits per day (PCC)",
            "Beat plan adherence %",
            "Productive call %",
            "Visit strike rate %",
            "App login days",
            "Calls made",
            "Orders booked per day",
            "Drop size (₹/order)",
          ],
          compliance: [
            "GPS / geo-tag compliance %",
            "DAR / daily report submission %",
            "Order punching SLA %",
            "Photo capture compliance %",
            "Planogram compliance %",
            "Training module completion %",
            "Selfie / attendance photo compliance %",
          ],
          distribution: [
            "ECO — Effective coverage outlets",
            "New outlets added",
            "Outlet retention %",
            "ULPO — Unique lines per outlet",
            "Range selling %",
            "Must-sell SKU strike rate %",
            "Focus SKU / NPD billing",
          ],
          sales_hygiene: [
            "Sales return %",
            "Damaged / expired stock %",
            "Scheme / claim accuracy %",
            "Primary vs secondary variance %",
            "Stock-out days",
          ],
        },
      ],
    },
    {
      createdBy: "system",
      modifiedBy: "system",
      creationTime: null,
      lastModifiedTime: null,
      lob: null,
      id: "dummy-consequence-options",
      activeStatus: "active",
      version: 1,
      source: null,
      domainName: CONSEQUENCE_DOMAIN_NAME,
      domainType: CONSEQUENCE_DOMAIN_TYPE,
      description: "Gate-rule consequence options shown in the picker",
      domainValues: [
        [
          { kind: "zero-all", label: "Rep earns ₹0 for this entire programme" },
          { kind: "zero-kpis", label: "Rep earns ₹0 for specific KPIs" },
          { kind: "reduce", label: "Rep earns only {percent}% of payout for {scope}" },
          { kind: "custom", label: "Custom description" },
        ] as ConsequenceOption[],
      ],
    },
  ],
};

// Session cache: (domainName::domainType) → in-flight or resolved features.
const configCache = new Map<string, Promise<ConfigFeature[]>>();

/**
 * Fetch the active configuration features for a (domainName, domainType) pair.
 * Cached for the session — the first call hits the API (or dummy fallback),
 * subsequent calls reuse the same promise.
 */
export async function fetchConfigFeatures<TValue = unknown>(
  domainName: string,
  domainType: string,
  /**
   * Dummy features to serve when the API is unavailable or returns nothing for
   * this domain. Defaults to the bundled DUMMY_CONFIG. Callers with large config
   * payloads (e.g. KPI sections) pass their own so the data lives next to its
   * feature code instead of in this generic client.
   */
  dummyFeatures?: ConfigFeature[]
): Promise<ConfigFeature<TValue>[]> {
  const key = `${domainName}::${domainType}`;
  const cached = configCache.get(key);
  if (cached) return cached as Promise<ConfigFeature<TValue>[]>;

  const matches = (f: ConfigFeature) =>
    f.domainName === domainName && f.domainType === domainType;
  const fallback = () => (dummyFeatures ?? DUMMY_CONFIG.features).filter(matches);

  const load = (async (): Promise<ConfigFeature[]> => {
    const qs = new URLSearchParams({ domainName, domainType });
    try {
      const res = await fetch(`${SALESHUB_BASE_URL}${CONFIG_ENDPOINT}?${qs}`, {
        headers: saleshubHeaders(),
      });
      if (!res.ok) throw new Error(`config responded ${res.status}`);
      const data = (await res.json()) as ConfigResponse;
      const matched = (data.features ?? []).filter(matches);
      // API reachable but this domain isn't configured yet → use the dummy.
      return matched.length ? matched : fallback();
    } catch {
      // API not available yet — serve the bundled dummy config in wire shape.
      return fallback();
    }
  })();

  configCache.set(key, load);
  return load as Promise<ConfigFeature<TValue>[]>;
}

/**
 * Fetch the gate-rule metric groups from config. Returns the first active
 * feature's domainValues object, or {} if none is configured.
 */
export async function fetchMetricGroups(): Promise<MetricGroups> {
  const features = await fetchConfigFeatures<MetricGroups>(
    METRIC_GROUPS_DOMAIN_NAME,
    METRIC_GROUPS_DOMAIN_TYPE
  );
  const active =
    features.find((f) => f.activeStatus === "active") ?? features[0];
  const values = active?.domainValues?.[0];
  return values && typeof values === "object" ? values : {};
}

/**
 * Fetch the gate-rule consequence options from config. Returns the first active
 * feature's domainValues array, or [] if none is configured.
 */
export async function fetchConsequenceOptions(): Promise<ConsequenceOptions> {
  const features = await fetchConfigFeatures<ConsequenceOptions>(
    CONSEQUENCE_DOMAIN_NAME,
    CONSEQUENCE_DOMAIN_TYPE
  );
  const active =
    features.find((f) => f.activeStatus === "active") ?? features[0];
  const values = active?.domainValues?.[0];
  return Array.isArray(values) ? values : [];
}

/** Zone → State → City tree, keyed by display name (matches the picker's shape). */
export type GeographyTree = Record<string, Record<string, string[]>>;

/**
 * Build the Zone → State → City geography tree from SalesHub master data.
 * Regions (level 2) become zones; each region's subtree supplies its states
 * (level 3) and their districts (level 4) as the selectable "cities".
 */
export async function fetchGeographyTree(): Promise<GeographyTree> {
  const regions = (await fetchLocations({ level: REGION_LEVEL })).filter(
    (l) => String(l.level) === String(REGION_LEVEL) && l.active
  );

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
