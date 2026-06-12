import { SelectItem } from "@/components/ui/select";
import { LIBRARY_KPIS } from "./nsvTypes";

const GROUP_LABELS: Record<string, string> = {
  sales: "Sales KPIs",
  coverage: "Coverage & Distribution",
  collection: "Collection & Commercial Hygiene",
  productivity: "Productivity & App Discipline",
  compliance: "HR & Compliance",
};

const GROUP_ORDER = ["sales", "coverage", "collection", "productivity", "compliance"] as const;

/**
 * Render LIBRARY_KPIS grouped inside a <SelectContent>, excluding the calling KPI.
 */
export function GateKpiOptions({ excludeId }: { excludeId?: string }) {
  const visible = LIBRARY_KPIS.filter((k) => k.id !== excludeId);
  return (
    <>
      {GROUP_ORDER.map((group) => {
        const items = visible.filter((k) => (k.group ?? "sales") === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
              {GROUP_LABELS[group]}
            </div>
            {items.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.name}
              </SelectItem>
            ))}
          </div>
        );
      })}
    </>
  );
}
