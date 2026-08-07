// Typed fetchers for the two KPI config domains, plus their domain coordinates.
// Both read from the live /ui-configs endpoint via the generic, session-cached
// fetchConfigFeature in saleshubApi (single config object per domain, carrying
// `domainValue`).
//
// The config API is the ONLY source of KPIs — the app bundles no catalogue and
// has no fallback. The seed payloads for both domains live next to this file as
// *.seed.json (data only; nothing imports them).

import { fetchConfigFeature } from "@/lib/saleshubApi";
import type { KpiMeta } from "./kpiSchema";

// ── Config 1 — the KPI catalogue ─────────────────────────────────────────────
export const KPI_SECTION_DOMAIN = { name: "incentiveconfig", type: "kpi_section_configuration" };

// ── Config 2 — portal visibility ─────────────────────────────────────────────
// A second, separate KPI config that decides WHICH KPIs are shown in the portal
// (the builder's "Add KPI" picker and the KPI library page) and in WHAT ORDER.
// The section config above is the catalogue of every KPI that exists; this one
// is the curated subset surfaced to the user. Keeping them separate means you
// can hide/reorder KPIs on the portal without touching their definitions.
//
// `domainValue` shape: { visibleKpiIds: string[] } — ordered list of KPI ids.
// Omitted/empty → show every KPI in the catalogue, in config order.

export const KPI_VISIBILITY_DOMAIN = {
  name: "incentiveconfig",
  type: "kpi_portal_visibility_configuration",
};

export interface KpiVisibilityValue {
  visibleKpiIds: string[];
}

/**
 * Config 1 — the KPI "details" config: an array of KPI objects, each carrying
 * its own `tag` (segregation/group) and the ordered list of `sections` it
 * renders. This is the full catalogue of every KPI that exists. Returns [] if
 * the config is missing or the API call fails — with no bundled fallback, the
 * caller treats that as "catalogue unavailable" (see useKpiCatalog).
 */
export async function fetchKpiSections(): Promise<KpiMeta[]> {
  const config = await fetchConfigFeature<{ kpis: KpiMeta[] }>(
    KPI_SECTION_DOMAIN.name,
    KPI_SECTION_DOMAIN.type
  );
  return config?.domainValue?.kpis ?? [];
}

/**
 * Config 2 — the portal-visibility config: the ordered list of KPI ids that
 * should be shown in the portal (the "Add KPI" picker and the KPI library
 * page). A curated, reorderable subset of the catalogue above. Returns [] if
 * the config is missing or the API call fails, which shows the whole catalogue.
 */
export async function fetchKpiVisibility(): Promise<string[]> {
  const config = await fetchConfigFeature<KpiVisibilityValue>(
    KPI_VISIBILITY_DOMAIN.name,
    KPI_VISIBILITY_DOMAIN.type
  );
  return config?.domainValue?.visibleKpiIds ?? [];
}
