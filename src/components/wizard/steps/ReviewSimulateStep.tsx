import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, AlertTriangle, ChevronUp, ChevronDown, Plus, Trash2, Pencil } from "lucide-react";
import type { BuilderState, ProgramKpi, KpiGroup } from "../builderState";
import { KPI_TEMPLATE_MAP, kpiDisplayName } from "@/components/kpi-library/registry";
import { ConfigDrivenKpiCard } from "@/components/kpi-library/ConfigDrivenKpiCard";
import { quarterForMonth } from "@/lib/programStore";
import { AudienceContextChip } from "../AudienceContextChip";

interface Props {
  state: BuilderState;
  onGoLive: () => void;
  onKpisChange?: (v: ProgramKpi[]) => void;
  onGroupsChange?: (v: KpiGroup[]) => void;
  onJumpToAddKpi?: () => void;
  /** Jump to a specific wizard step number (1-4). When provided, each section
   *  shows an edit pencil so the user can jump out → edit → return to review. */
  onEditStep?: (step: number) => void;
  lockedRole?: "mr" | "aso";
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function ReviewSimulateStep({ state, onGoLive, onKpisChange, onJumpToAddKpi, onEditStep }: Props) {
  const { basics, audience, programKpis, gates } = state;
  const q = quarterForMonth(basics.month, basics.year);
  const [expanded, setExpanded] = useState<string | null>(null);

  let monthlyTotal = 0;
  let quarterlyTotal = 0;
  for (const k of programKpis) {
    const m = KPI_TEMPLATE_MAP[k.templateId].maxPayout(k.config) ?? 0;
    if (k.templateId === "qnsv") quarterlyTotal += m;
    else monthlyTotal += m;
  }
  const total = monthlyTotal + quarterlyTotal;

  const pendingTargets = programKpis.filter((k) => {
    const c = k.config as { targetStatus?: string } | undefined;
    return c?.targetStatus === "later";
  });

  const updateKpiConfig = (instanceId: string, config: unknown) => {
    if (!onKpisChange) return;
    onKpisChange(programKpis.map((k) => (k.instanceId === instanceId ? { ...k, config } : k)));
  };

  const removeKpi = (instanceId: string) => {
    if (!onKpisChange) return;
    onKpisChange(programKpis.filter((k) => k.instanceId !== instanceId));
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Review</h2>
          <p className="text-sm text-muted-foreground">Verify the programme spec, then publish.</p>
          <AudienceContextChip audience={audience} />
        </div>
        <Button onClick={onGoLive} className="gap-1"><Rocket size={14} />Go live</Button>
      </div>

      {pendingTargets.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Targets pending upload ({pendingTargets.length})
              </h3>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                The programme is fully configured, but targets for the following KPIs are marked
                "upload later". They must be uploaded before {q.label} starts, otherwise these KPIs
                will not pay out.
              </p>
              <ul className="text-xs text-amber-900 dark:text-amber-200 list-disc list-inside pt-1">
                {pendingTargets.map((k) => (
                  <li key={k.instanceId}>{kpiDisplayName(k.templateId, k.customName)}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Programme basics</h3>
          {onEditStep && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onEditStep(1)}>
              <Pencil size={12} /> Edit
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{basics.name || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Month</dt><dd>{q.full}</dd></div>
          <div><dt className="text-muted-foreground">Period</dt><dd>{basics.period}</dd></div>
          <div><dt className="text-muted-foreground">Attainment basis</dt><dd>{basics.attainmentBasis}</dd></div>
          <div><dt className="text-muted-foreground">Currency</dt><dd>{basics.currency}</dd></div>
          <div><dt className="text-muted-foreground">Payout frequency</dt><dd>{basics.payoutFrequency}</dd></div>
        </dl>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Audience</h3>
          {onEditStep && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onEditStep(2)}>
              <Pencil size={12} /> Edit
            </Button>
          )}
        </div>
        <div className="space-y-1 text-xs">
          <div><span className="text-muted-foreground">Role: </span>{audience.roles[0] || "—"}</div>
          <div><span className="text-muted-foreground">Geography: </span>{audience.geographies.join(", ")}</div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold">KPIs ({programKpis.length})</h3>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Badge variant="outline" className="text-[10px]">Month-end {fmt(monthlyTotal)}</Badge>
            <Badge variant="outline" className="text-[10px]">Quarter-end {fmt(quarterlyTotal)}</Badge>
            <Badge className="text-[10px]">Total {fmt(total)}</Badge>
            {onEditStep && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onEditStep(3)}>
                <Pencil size={12} /> Edit
              </Button>
            )}
          </div>
        </div>

        {programKpis.length === 0 ? (
          <p className="text-xs text-muted-foreground">No KPIs added.</p>
        ) : (
          <div className="space-y-2">
            {programKpis.map((k) => {
              const tpl = KPI_TEMPLATE_MAP[k.templateId];
              const max = tpl.maxPayout(k.config);
              const isOpen = expanded === k.instanceId;
              return (
                <div key={k.instanceId} className="border border-border rounded-md">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : k.instanceId)}
                    className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-muted/30"
                  >
                    <div>
                      <div className="text-sm font-medium">{kpiDisplayName(k.templateId, k.customName)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {k.customName?.trim() ? <span className="mr-1">{tpl.meta.name} ·</span> : null}
                        {tpl.summarize(k.config)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {max != null && <Badge variant="outline" className="text-[10px]">{fmt(max)}</Badge>}
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="p-3 border-t border-border space-y-3">
                      <ConfigDrivenKpiCard
                        meta={tpl.meta}
                        tag={tpl.tag}
                        value={k.config}
                        onChange={(cfg: unknown) => updateKpiConfig(k.instanceId, cfg)}
                      />
                      {onKpisChange && (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                            onClick={() => removeKpi(k.instanceId)}
                          >
                            <Trash2 size={12} />Remove KPI
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {onJumpToAddKpi && (
          <div className="pt-3 mt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 w-full"
              onClick={onJumpToAddKpi}
            >
              <Plus size={14} />Add KPI
            </Button>
          </div>
        )}
      </Card>

      {(gates.length > 0 || onEditStep) && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Programme-level gates</h3>
            {onEditStep && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onEditStep(4)}>
                <Pencil size={12} /> Edit
              </Button>
            )}
          </div>
          {gates.length > 0 ? (
            <ul className="text-xs space-y-1 list-disc list-inside">
              {gates.map((_, i) => (
                <li key={i}>Gate rule #{i + 1}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No gates configured.</p>
          )}
        </Card>
      )}
    </div>
  );
}
