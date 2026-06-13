// Bundled dummy KPI configuration — stands in for the live config API until it
// exists. This is PURE DATA: the entire KPI config is the JSON in
// kpiConfig.dummy.json (an array of KPI objects, each with its own `tag`,
// `defaultConfig`, and `sections`). No functions, no code — exactly what the
// API will return under (domainName=incentiveconfig, domainType=
// kpi_section_configuration). Editing/adding a KPI is a pure data change.

import type { ConfigFeature } from "@/lib/saleshubApi";
import type { KpiMeta } from "./kpiSchema";
import kpiConfig from "./kpiConfig.dummy.json";

export const KPI_SECTION_DOMAIN = { name: "incentiveconfig", type: "kpi_section_configuration" };

export const DUMMY_KPI_METAS = (kpiConfig as { kpis: KpiMeta[] }).kpis;

export const DUMMY_KPI_SECTION_FEATURE: ConfigFeature = {
  createdBy: "system",
  modifiedBy: "system",
  creationTime: null,
  lastModifiedTime: null,
  lob: null,
  id: "dummy-kpi-sections",
  activeStatus: "active",
  version: 1,
  source: null,
  domainName: KPI_SECTION_DOMAIN.name,
  domainType: KPI_SECTION_DOMAIN.type,
  description: null,
  domainValues: [{ kpis: DUMMY_KPI_METAS }],
};
