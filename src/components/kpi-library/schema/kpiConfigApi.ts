// Typed fetchers for the two KPI config domains. Both read from the live
// /ui-configs endpoint via the generic, session-cached fetchConfigFeature in
// saleshubApi (single config object per domain, carrying `domainValue`).

import { fetchConfigFeature } from "@/lib/saleshubApi";
import type { KpiMeta } from "./kpiSchema";
import {
  KPI_SECTION_DOMAIN,
  KPI_VISIBILITY_DOMAIN,
  type KpiVisibilityValue,
} from "./dummyKpiConfig";

/**
 * Config 1 — the KPI "details" config: an array of KPI objects, each carrying
 * its own `tag` (segregation/group) and the ordered list of `sections` it
 * renders. This is the full catalogue of every KPI that exists. Returns [] if
 * the config is missing or the API call fails.
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
 * the config is missing or the API call fails.
 */
export async function fetchKpiVisibility(): Promise<string[]> {
  const config = await fetchConfigFeature<KpiVisibilityValue>(
    KPI_VISIBILITY_DOMAIN.name,
    KPI_VISIBILITY_DOMAIN.type
  );
  return config?.domainValue?.visibleKpiIds ?? [];
}
