// Test stand-in for the KPI config API.
//
// The app bundles no KPI catalogue — every KPI comes from the config API at
// runtime (incentiveconfig / kpi_section_configuration), and the module-level
// catalog starts empty. Tests can't fetch, so they install the seed payload that
// is pushed to that config service as the catalog. setup.ts does this before
// every test file, which is what the running app does on shell mount.

import { buildCatalog, setKpiCatalog } from "@/components/kpi-library/schema/kpiCatalog";
import type { KpiMeta } from "@/components/kpi-library/schema/kpiSchema";
import seed from "@/components/kpi-library/schema/kpi_section_configuration.seed.json";

export const FIXTURE_KPI_METAS = (seed as unknown as { domainValue: { kpis: KpiMeta[] } })
  .domainValue.kpis;

/** Install the fixture catalogue as the module-level catalog (what the API does). */
export function installFixtureKpiCatalog() {
  const catalog = buildCatalog(FIXTURE_KPI_METAS);
  setKpiCatalog(catalog);
  return catalog;
}
