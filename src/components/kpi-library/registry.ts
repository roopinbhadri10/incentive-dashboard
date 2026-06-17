// KPI registry — now a thin compatibility layer over the config-driven catalog
// (schema/kpiCatalog.ts). KPI metadata, segregation, and section schema come
// from config (API → bundled dummy fallback). The bespoke per-KPI card
// components have been replaced by the generic ConfigDrivenKpiCard renderer.
//
// `KpiTemplateId` stays a static union because the 14 ids are referenced as
// keys across programStore / rulePayload / builderState. Config-only KPIs added
// in the future use `KpiTemplateIdOrCustom`.

import { getKpiCatalog, type CatalogEntry } from "./schema/kpiCatalog";

export type KpiTemplateId =
  | "nsv"
  | "phasing"
  | "eco"
  | "tlsd"
  | "dbb"
  | "qnsv"
  | "collection"
  | "new_outlets"
  | "range_selling"
  | "pcc"
  | "call_compliance"
  | "must_sell_sku"
  | "ulpo"
  | "ai_recommended_order";

// Allow config-defined KPIs beyond the built-in union without losing literal
// autocompletion for the known ids.
export type KpiTemplateIdOrCustom = KpiTemplateId | (string & {});

export type { CatalogEntry };

/**
 * Lookup map by KPI id, backed by the live catalog. Each entry exposes
 * `meta`, `tag`, `defaultConfig()`, `maxPayout()`, `summarize()`.
 * (The old `.Component` was replaced by <ConfigDrivenKpiCard meta tag/>.)
 */
export const KPI_TEMPLATE_MAP: Record<string, CatalogEntry> = new Proxy(
  {} as Record<string, CatalogEntry>,
  { get: (_t, id: string) => getKpiCatalog().entries[id] },
);

/** Pick the display name for a KPI instance, falling back to the template name. */
export function kpiDisplayName(
  templateId: KpiTemplateIdOrCustom,
  customName?: string | null,
): string {
  const trimmed = (customName ?? "").trim();
  return trimmed || getKpiCatalog().entries[templateId]?.meta.name || templateId;
}
