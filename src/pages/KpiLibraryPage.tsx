import { useState } from "react";
import { Library, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfigDrivenKpiCard } from "@/components/kpi-library/ConfigDrivenKpiCard";
import { useKpiCatalog } from "@/components/kpi-library/useKpiCatalog";

export function KpiLibraryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { templates } = useKpiCatalog();

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Library size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">KPI Library</h1>
            <p className="text-sm text-muted-foreground">
              Reusable KPI templates. Configure here once — pick from these when building a programme for any role.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded bg-muted text-muted-foreground">Currency: ₹ (locked)</span>
          <span className="px-2 py-1 rounded bg-muted text-muted-foreground">Payout: Monthly (Quarterly KPIs excepted)</span>
          <span className="px-2 py-1 rounded bg-muted text-muted-foreground">No duplicate slabs · No duplicate KPIs in a programme</span>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((k) => {
            const isExpanded = expandedId === k.meta.id;
            if (isExpanded) {
              return (
                <div key={k.meta.id} className="md:col-span-2 xl:col-span-3 space-y-2">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(null)} className="gap-1 text-xs">
                      <ChevronUp size={14} /> Collapse
                    </Button>
                  </div>
                  <ConfigDrivenKpiCard meta={k.meta} tag={k.tag} hideRoleSelector />
                </div>
              );
            }
            return (
              <button key={k.meta.id} onClick={() => setExpandedId(k.meta.id)} className="text-left">
                <Card className="p-4 h-full hover:border-primary hover:shadow-sm transition cursor-pointer">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{k.meta.name}</h3>
                    <ChevronDown size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] mb-2">{k.tag}</Badge>
                  <p className="text-xs text-muted-foreground mb-3">{k.meta.description}</p>
                  <div className="text-[11px] text-foreground bg-muted/40 rounded px-2 py-1.5 border border-border">
                    {k.meta.sample}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
