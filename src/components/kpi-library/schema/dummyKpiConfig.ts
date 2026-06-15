// KPI config domain coordinates + the bundled catalogue used only as the
// synchronous first-paint seed for the runtime catalog (see kpiCatalog.ts).
// The live config API (/ui-configs) is the source of truth at runtime — see
// kpiConfigApi.ts. kpiConfig.dummy.json holds the catalogue data that seeds the
// API under (domainName=incentiveconfig, domainType=kpi_section_configuration).

import type { KpiMeta } from "./kpiSchema";
import kpiConfig from "./kpiConfig.dummy.json";

export const KPI_SECTION_DOMAIN = { name: "incentiveconfig", type: "kpi_section_configuration" };

export const DUMMY_KPI_METAS = (kpiConfig as { kpis: KpiMeta[] }).kpis;

// ── Portal visibility config ─────────────────────────────────────────────────
// A second, separate KPI config that decides WHICH KPIs are shown in the portal
// (the builder's "Add KPI" picker and the KPI library page) and in WHAT ORDER.
// The section config above is the catalogue of every KPI that exists; this one
// is the curated subset surfaced to the user. Keeping them separate means you
// can hide/reorder KPIs on the portal without touching their definitions.
//
// `domainValue` shape: { visibleKpiIds: string[] } — ordered list of KPI ids.
// Default (dummy) = every KPI in the section config, in its config order.

export const KPI_VISIBILITY_DOMAIN = {
  name: "incentiveconfig",
  type: "kpi_portal_visibility_configuration",
};

export interface KpiVisibilityValue {
  visibleKpiIds: string[];
}
