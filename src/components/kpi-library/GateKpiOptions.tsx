import { SelectItem } from "@/components/ui/select";
import { useKpiCatalog } from "./useKpiCatalog";
import type { KpiCatalog } from "./schema/kpiCatalog";
import type { KpiMeta, ComputeId } from "./schema/kpiSchema";
import type { GateThresholdUnit } from "./nsvTypes";

export interface GateKpiOption {
  id: string;
  name: string;
  /** The KPI's segregation tag (from the section config) — used as the group heading. */
  group: string;
  /** Sensible initial threshold unit, inferred from the KPI's config / compute. */
  defaultUnit: GateThresholdUnit;
}

// Infer the gate threshold unit from a KPI's config: simple-ladder KPIs carry an
// explicit `unit`; otherwise % for achievement-style slab KPIs and count for
// coverage / line-count KPIs.
function inferUnit(meta: KpiMeta): GateThresholdUnit {
  const unit = (meta.defaultConfig as { unit?: string } | undefined)?.unit;
  if (unit === "pct" || unit === "count" || unit === "amount") return unit;
  const byCompute: Partial<Record<ComputeId, GateThresholdUnit>> = {
    slabEarnings: "pct",
    ecoLadder: "count",
    linesLadder: "count",
  };
  return byCompute[meta.computeId] ?? "pct";
}

/**
 * Gate "Dependent on KPI" options derived from the KPI section config
 * (kpi_section_configuration, served by /ui-configs). No hardcoded KPI list —
 * every KPI in the catalogue is selectable, grouped by its tag.
 */
export function gateKpiOptions(catalog: KpiCatalog): GateKpiOption[] {
  return Object.values(catalog.entries).map((e) => ({
    id: e.meta.id,
    name: e.meta.name,
    group: e.meta.tag,
    defaultUnit: inferUnit(e.meta),
  }));
}

/** Hook variant — options from the live (session-cached) catalog. */
export function useGateKpiOptions(): GateKpiOption[] {
  return gateKpiOptions(useKpiCatalog());
}

/**
 * Render gate KPI options grouped by tag inside a <SelectContent>, excluding the
 * calling KPI. Groups appear in config order.
 */
export function GateKpiOptions({
  options,
  excludeId,
}: {
  options: GateKpiOption[];
  excludeId?: string;
}) {
  const visible = options.filter((k) => k.id !== excludeId);
  const groups: string[] = [];
  for (const o of visible) if (!groups.includes(o.group)) groups.push(o.group);
  return (
    <>
      {groups.map((group) => (
        <div key={group}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
            {group}
          </div>
          {visible
            .filter((k) => k.group === group)
            .map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.name}
              </SelectItem>
            ))}
        </div>
      ))}
    </>
  );
}
