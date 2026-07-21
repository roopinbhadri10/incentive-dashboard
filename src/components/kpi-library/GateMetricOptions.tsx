// Shared gate-rule metric picker options, sourced from config so the KPI-level
// gate ("Dependent on KPI", inside the KPI form) and the program-level gate
// ("Gate rules" step) offer the exact same list. The canonical source is the
// gate_rule_metric_group_configuration config (fetched via saleshubApi); an
// optional "From your KPIs" group and a "Custom" entry frame it.
//
// Value scheme (shared by both pickers): `kpi::<id>`, `<group>::<gateCode>`,
// `custom::<name>`.

import { useEffect, useState } from "react";
import { SelectItem } from "@/components/ui/select";
import { fetchMetricGroups, type MetricGroups } from "@/lib/saleshubApi";

const GROUP_HEADER = "text-[10px] uppercase text-muted-foreground px-2 py-1";

/** Live gate-rule metric groups from config. Empty until loaded / on failure. */
export function useMetricGroups(): MetricGroups {
  const [groups, setGroups] = useState<MetricGroups>({});
  useEffect(() => {
    fetchMetricGroups()
      .then(setGroups)
      .catch(() => setGroups({}));
  }, []);
  return groups;
}

/** A "From your KPIs" entry — the KPIs already added to the programme. */
export interface GateMetricKpi {
  id: string;
  label: string;
}

/** First selectable metric value (`<group>::<gateCode>`), else the custom placeholder. */
export function firstMetricValue(metricGroups: MetricGroups): string {
  for (const [group, items] of Object.entries(metricGroups)) {
    if (items.length) return `${group}::${items[0].gateCode}`;
  }
  return "custom::Custom metric";
}

/**
 * Render the shared gate-metric options inside a <SelectContent>: an optional
 * "From your KPIs" group, every configured metric group, then a "Custom" entry.
 */
export function GateMetricOptions({
  metricGroups,
  kpis,
}: {
  metricGroups: MetricGroups;
  kpis?: GateMetricKpi[];
}) {
  return (
    <>
      {kpis && kpis.length > 0 && (
        <div>
          <div className={GROUP_HEADER}>From your KPIs</div>
          {kpis.map((k) => (
            <SelectItem key={k.id} value={`kpi::${k.id}`}>
              {k.label}
            </SelectItem>
          ))}
        </div>
      )}
      {Object.entries(metricGroups).map(([group, items]) => (
        <div key={group}>
          <div className={GROUP_HEADER}>{group}</div>
          {items.map((m) => (
            <SelectItem key={`${group}-${m.gateCode}`} value={`${group}::${m.gateCode}`}>
              {m.name}
            </SelectItem>
          ))}
        </div>
      ))}
      <div>
        <div className={GROUP_HEADER}>Custom</div>
        <SelectItem value="custom::Custom metric">Custom metric…</SelectItem>
      </div>
    </>
  );
}
