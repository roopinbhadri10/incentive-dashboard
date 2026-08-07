// React hook that loads the KPI catalog from the live config API (session-
// cached) and keeps the module-level catalog in sync.
//
// The config API is the only source of KPIs — nothing is bundled — so there is
// no data to render before the fetch lands. The hook reports `isLoading` /
// `isError` alongside the catalog, and the app shell holds the routed page back
// until it resolves (see AppLayout), which also keeps the synchronous consumers
// (getKpiCatalog) from running against an empty catalog.

import { useQuery } from "@tanstack/react-query";
import { fetchKpiSections, fetchKpiVisibility } from "./schema/kpiConfigApi";
import {
  buildCatalog, getKpiCatalog, setKpiCatalog, isKpiCatalogLoaded, type KpiCatalog,
} from "./schema/kpiCatalog";

export interface KpiCatalogState extends KpiCatalog {
  /** No catalog yet and the first fetch is still in flight. */
  isLoading: boolean;
  /** No catalog and the config API failed / returned no KPIs. */
  isError: boolean;
  /** Re-run the config fetch (the error state offers a retry). */
  refetch: () => void;
}

export function useKpiCatalog(): KpiCatalogState {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["kpi-catalog"],
    queryFn: async () => {
      // Both KPI configs in parallel: the catalogue (sections) + the portal
      // visibility subset. The catalog keeps every KPI resolvable via `entries`
      // while `templates` is the visible, ordered list shown in the portal.
      const [metas, visibleIds] = await Promise.all([
        fetchKpiSections(),
        fetchKpiVisibility(),
      ]);
      // With no bundled catalogue there is nothing to fall back on, and the
      // fetchers collapse "config missing" and "API failed" into []. Treat it as
      // a failure to load (react-query then retries) rather than rendering an
      // empty KPI library that reads as "no KPIs configured".
      if (!metas.length) throw new Error("KPI section configuration is unavailable");
      const catalog = buildCatalog(metas, visibleIds);
      setKpiCatalog(catalog);
      return catalog;
    },
    // staleTime 0 → revalidate on every mount, so a session that failed to load
    // the config self-heals on the next mount instead of sticking until a hard
    // refresh. Successful calls are deduped for the session by saleshubApi's
    // config cache, so revalidation is cheap.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Fall back to the module-level catalog while a remount revalidates, so the
  // last good config keeps rendering instead of flashing the loading state.
  const catalog = data ?? getKpiCatalog();
  const loaded = isKpiCatalogLoaded();
  return {
    ...catalog,
    isLoading: isPending && !loaded,
    isError: isError && !loaded,
    refetch: () => void refetch(),
  };
}
