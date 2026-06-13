// Typed fetcher for the single KPI config domain. Reuses the generic, session-
// cached fetchConfigFeatures from saleshubApi, passing the bundled dummy feature
// as the fallback so the large KPI payload lives next to the KPI code.

import { fetchConfigFeatures, type ConfigFeature } from "@/lib/saleshubApi";
import type { KpiMeta } from "./kpiSchema";
import { KPI_SECTION_DOMAIN, DUMMY_KPI_SECTION_FEATURE, DUMMY_KPI_METAS } from "./dummyKpiConfig";

function firstActive<T>(features: ConfigFeature<T>[]): T | undefined {
  const active = features.find((f) => f.activeStatus === "active") ?? features[0];
  return active?.domainValues?.[0];
}

/**
 * The single KPI config: an array of KPI objects, each carrying its own `tag`
 * (segregation/group) and the ordered list of `sections` it renders.
 */
export async function fetchKpiSections(): Promise<KpiMeta[]> {
  const features = await fetchConfigFeatures<{ kpis: KpiMeta[] }>(
    KPI_SECTION_DOMAIN.name,
    KPI_SECTION_DOMAIN.type,
    [DUMMY_KPI_SECTION_FEATURE],
  );
  return firstActive(features)?.kpis ?? DUMMY_KPI_METAS;
}
