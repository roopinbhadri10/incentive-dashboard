import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, ChevronDown, ChevronUp } from "lucide-react";
import type { SavedProgram } from "@/lib/programStore";
import { KPI_TEMPLATE_MAP, kpiDisplayName } from "@/components/kpi-library/registry";

interface Props {
  program: SavedProgram;
  onBack: () => void;
  onClone: () => void;
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function ProgramDetailView({ program, onBack, onClone }: Props) {
  const [expanded, setExpanded] = useState<string | null>(program.kpis[0]?.instanceId ?? null);
  const total = program.kpis.reduce((s, k) => {
    const m = KPI_TEMPLATE_MAP[k.templateId].maxPayout(k.config);
    return s + (m ?? 0);
  }, 0);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-4 border-b border-border bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft size={14} /> All Programs</Button>
          <div>
            <h1 className="text-lg font-semibold">{program.name}</h1>
            <div className="text-xs text-muted-foreground">{program.role} · {program.quarterLabel}</div>
          </div>
        </div>
        <Button size="sm" onClick={onClone} className="gap-1"><Copy size={14} /> Clone</Button>
      </div>

      <div className="px-8 py-6 max-w-5xl space-y-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Basics</h3>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div><dt className="text-muted-foreground">Month</dt><dd>{program.quarterLabel}</dd></div>
            <div><dt className="text-muted-foreground">Attainment</dt><dd>{program.attainmentBasis}</dd></div>
            <div><dt className="text-muted-foreground">Currency</dt><dd>{program.currency}</dd></div>
            <div><dt className="text-muted-foreground">Payout frequency</dt><dd>{program.payoutFrequency}</dd></div>
            {program.channel && <div><dt className="text-muted-foreground">Division</dt><dd>{program.channel}</dd></div>}
            <div><dt className="text-muted-foreground">Role</dt><dd>{program.role}</dd></div>
            <div><dt className="text-muted-foreground">Geography</dt><dd>{program.geographies.join(", ")}{program.geographyExceptions?.length ? ` — except ${program.geographyExceptions.join(", ")}` : ""}</dd></div>
          </dl>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">KPIs ({program.kpis.length})</h3>
            <Badge variant="outline" className="text-[10px]">Max payout {fmt(total)}</Badge>
          </div>
          <div className="space-y-2">
            {program.kpis.map((k) => {
              const tpl = KPI_TEMPLATE_MAP[k.templateId];
              const isOpen = expanded === k.instanceId;
              const max = tpl.maxPayout(k.config);
              const C = tpl.Component;
              return (
                <div key={k.instanceId} className="border border-border rounded-md">
                  <button
                    onClick={() => setExpanded(isOpen ? null : k.instanceId)}
                    className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-muted/30"
                  >
                    <div>
                      <div className="text-sm font-medium">{kpiDisplayName(k.templateId, k.customName)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {k.customName?.trim() ? <span className="mr-1">{tpl.name} ·</span> : null}
                        {tpl.summarize(k.config)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {max != null && <Badge variant="outline" className="text-[10px]">{fmt(max)}</Badge>}
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="p-3 border-t border-border">
                      <C value={k.config} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
