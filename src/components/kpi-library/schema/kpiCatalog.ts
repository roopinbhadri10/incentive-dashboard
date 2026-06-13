// Runtime KPI catalog — derives the per-KPI bound helpers (defaultConfig /
// maxPayout / summarize) from the single KPI config array (KpiMeta[]), binding
// the math via computeId. Each KPI carries its own `tag`.
//
// Seeded synchronously from the bundled dummy config at module load so the
// synchronous consumers (registry shims, non-React converters) work offline and
// on first paint. useKpiCatalog() refreshes it from the API.

import type { KpiMeta } from "./kpiSchema";
import { COMPUTE_REGISTRY } from "./computeRegistry";
import { DUMMY_KPI_METAS } from "./dummyKpiConfig";

export interface CatalogEntry {
  meta: KpiMeta;
  /** Segregation / group label (the KPI's "tag"), taken from the config. */
  tag: string;
  defaultConfig: () => unknown;
  maxPayout: (cfg: unknown) => number | null;
  summarize: (cfg: unknown) => string;
}

export interface KpiCatalog {
  entries: Record<string, CatalogEntry>;
  templates: CatalogEntry[]; // ordered as in config
}

export function buildCatalog(metas: KpiMeta[]): KpiCatalog {
  const templates = metas.map((meta): CatalogEntry => {
    const compute = COMPUTE_REGISTRY[meta.computeId];
    return {
      meta,
      tag: meta.tag,
      defaultConfig: () => structuredClone(meta.defaultConfig),
      maxPayout: (cfg) => compute.maxPayout(cfg),
      summarize: (cfg) => compute.summarize(cfg),
    };
  });

  const entries: Record<string, CatalogEntry> = {};
  for (const t of templates) entries[t.meta.id] = t;
  return { entries, templates };
}

// Module-level current catalog (mutable, like the saleshubApi config cache).
let currentCatalog: KpiCatalog = buildCatalog(DUMMY_KPI_METAS);

export function getKpiCatalog(): KpiCatalog {
  return currentCatalog;
}

export function setKpiCatalog(catalog: KpiCatalog): void {
  currentCatalog = catalog;
}
