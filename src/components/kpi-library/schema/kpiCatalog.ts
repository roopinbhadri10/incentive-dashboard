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
  /** Every KPI in the catalogue, keyed by id — used to resolve any instance,
   *  including ones hidden from the portal but already added to a programme. */
  entries: Record<string, CatalogEntry>;
  /** The portal-visible KPIs, ordered per the visibility config — what the
   *  "Add KPI" picker and KPI library page show. */
  templates: CatalogEntry[];
}

/**
 * Build the runtime catalog from the two KPI configs:
 *   - `metas`      — config 1 (kpi_section_configuration): the full catalogue.
 *   - `visibleIds` — config 2 (kpi_portal_visibility_configuration): the ordered
 *                    subset shown on the portal. Omitted/empty → show all, in
 *                    config order. Unknown ids are ignored.
 */
export function buildCatalog(metas: KpiMeta[], visibleIds?: string[]): KpiCatalog {
  const all = metas.map((meta): CatalogEntry => {
    const compute = COMPUTE_REGISTRY[meta.computeId];
    // Reassemble the per-instance value object: the lone `dataFeed` base scalar
    // plus every section's co-located `defaults` fragment. Section keys don't
    // overlap, so a shallow merge is exact. `gates` sections imply the standard
    // disabled/empty pair when they carry no `defaults`. The resulting
    // `configValues` is the schema-free object cloned per instance — its shape is
    // load-bearing for the saved rule payload (kpiConfig.templateConfig).
    const sections = meta.defaultSection ?? [];
    const configValues: Record<string, unknown> =
      meta.dataFeed != null ? { dataFeed: meta.dataFeed } : {};
    for (const s of sections) {
      if (s.kind === "gates" && !s.defaults) {
        configValues[s.enabledPath] ??= false;
        configValues[s.gatesPath] ??= [];
      }
      if (s.defaults) Object.assign(configValues, structuredClone(s.defaults));
    }
    // Strip `defaults` from the schema the renderer reads — it's data, not UI.
    const renderSections = sections.map(({ defaults: _d, ...s }) => s) as KpiMeta["defaultSection"];
    const normMeta: KpiMeta = { ...meta, defaultSection: renderSections, defaultConfig: configValues };
    return {
      meta: normMeta,
      tag: normMeta.tag,
      defaultConfig: () => structuredClone(configValues),
      maxPayout: (cfg) => compute.maxPayout(cfg),
      summarize: (cfg) => compute.summarize(cfg),
    };
  });

  const entries: Record<string, CatalogEntry> = {};
  for (const t of all) entries[t.meta.id] = t;

  const templates = visibleIds?.length
    ? visibleIds.map((id) => entries[id]).filter(Boolean)
    : all;

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
