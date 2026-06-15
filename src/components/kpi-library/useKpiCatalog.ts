// React hook that loads the KPI catalog from the live config API (session-
// cached) and keeps the module-level catalog in sync. Returns the catalog
// immediately from the first-paint seed (initialData) so the UI renders before
// the API responds, then re-renders once the API data arrives.

import { useQuery } from "@tanstack/react-query";
import { fetchKpiSections, fetchKpiVisibility } from "./schema/kpiConfigApi";
import { buildCatalog, getKpiCatalog, setKpiCatalog, type KpiCatalog } from "./schema/kpiCatalog";

export function useKpiCatalog(): KpiCatalog {
  const { data } = useQuery({
    queryKey: ["kpi-catalog"],
    queryFn: async () => {
      // Both KPI configs in parallel: the catalogue (sections) + the portal
      // visibility subset. The catalog keeps every KPI resolvable via `entries`
      // while `templates` is the visible, ordered list shown in the portal.
      const [metas, visibleIds] = await Promise.all([
        fetchKpiSections(),
        fetchKpiVisibility(),
      ]);
      // If the API has no catalogue yet (not seeded / unreachable), keep the
      // first-paint seed rather than wiping the catalog to empty.
      if (!metas.length) return getKpiCatalog();
      const catalog = buildCatalog(metas, visibleIds);
      setKpiCatalog(catalog);
      return catalog;
    },
    // Seed first paint from the bundled catalog, but mark it stale (updatedAt 0)
    // so the queryFn still runs on mount and pulls the live config from the API.
    // staleTime 0 → revalidate on every mount, so a cold-load that fell back to
    // the seed (e.g. a transient config failure) self-heals on the next mount
    // instead of sticking until a hard refresh. Successful calls are deduped for
    // the session by saleshubApi's config cache, so revalidation is cheap.
    initialData: getKpiCatalog,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  return data;
}
