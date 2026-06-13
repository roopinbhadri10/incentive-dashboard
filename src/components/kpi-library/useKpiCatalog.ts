// React hook that loads the KPI catalog from config (API → dummy fallback,
// session-cached) and keeps the module-level catalog in sync. Returns the
// catalog immediately from the bundled dummy (initialData) so the UI renders on
// first paint, then re-renders when the API responds.

import { useQuery } from "@tanstack/react-query";
import { fetchKpiSections } from "./schema/kpiConfigApi";
import { buildCatalog, getKpiCatalog, setKpiCatalog, type KpiCatalog } from "./schema/kpiCatalog";

export function useKpiCatalog(): KpiCatalog {
  const { data } = useQuery({
    queryKey: ["kpi-catalog"],
    queryFn: async () => {
      const catalog = buildCatalog(await fetchKpiSections());
      setKpiCatalog(catalog);
      return catalog;
    },
    initialData: getKpiCatalog,
    staleTime: Infinity,
  });
  return data;
}
