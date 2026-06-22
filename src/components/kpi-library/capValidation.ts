// Shared cap validation: a cap, when enabled, must sit strictly ABOVE the last
// slab boundary — otherwise it would cap away part (or all) of the configured
// curve. Used both to flag the cap section in the editor and to block the wizard
// from proceeding past the KPI step. Generic across KPI types: the slab boundary
// is whichever ascending field the KPI uses (pct / count / threshold).

interface CapLikeConfig {
  slabs?: Array<{ pct?: number; count?: number; threshold?: number }>;
  cap?: Record<string, unknown>;
}

/** The top slab's boundary value (pct / count / threshold), or null if none. */
export function lastSlabBoundary(config: unknown): number | null {
  const slabs = (config as CapLikeConfig)?.slabs;
  if (!Array.isArray(slabs) || !slabs.length) return null;
  const last = slabs[slabs.length - 1];
  const b = last.pct ?? last.count ?? last.threshold;
  return typeof b === "number" ? b : null;
}

/** The cap's enabled flag and amount — the amount lives under a KPI-specific key. */
export function capValue(config: unknown): { enabled: boolean; value: number | null } {
  const cap = (config as CapLikeConfig)?.cap;
  if (!cap || typeof cap !== "object") return { enabled: false, value: null };
  const entry = Object.entries(cap).find(([k, v]) => k !== "enabled" && typeof v === "number");
  return { enabled: !!cap.enabled, value: (entry?.[1] as number | undefined) ?? null };
}

/** True when the cap is enabled but not strictly greater than the last slab boundary. */
export function isCapInvalid(config: unknown): boolean {
  const { enabled, value } = capValue(config);
  if (!enabled || value == null) return false;
  const top = lastSlabBoundary(config);
  if (top == null) return false;
  return value <= top;
}
