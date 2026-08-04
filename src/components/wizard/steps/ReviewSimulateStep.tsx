import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronUp, ChevronDown, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import type { BuilderState, ProgramKpi, KpiGroup } from "../builderState";
import { KPI_TEMPLATE_MAP, kpiDisplayName } from "@/components/kpi-library/registry";
import { ConfigDrivenKpiCard } from "@/components/kpi-library/ConfigDrivenKpiCard";
import { quarterForMonth } from "@/lib/programStore";
import { AudienceContextChip } from "../AudienceContextChip";
import { WizardAddButton } from "../ui/WizardAddButton";

interface Props {
  state: BuilderState;
  onKpisChange?: (v: ProgramKpi[]) => void;
  onGroupsChange?: (v: KpiGroup[]) => void;
  onJumpToAddKpi?: () => void;
  /** Jump to a specific wizard step number (1-4). When provided, each section
   *  shows an edit pencil so the user can jump out → edit → return to review. */
  onEditStep?: (step: number) => void;
  lockedRole?: "mr" | "aso";
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function ReviewSimulateStep({ state, onKpisChange, onJumpToAddKpi, onEditStep }: Props) {
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

  // Completion checks drive the "ready to publish" banner and gate the publish button.
  const basicsComplete = !!basics.name && !!basics.month && !!basics.year;
  const audienceComplete = (audience.roles?.length ?? 0) > 0 && (audience.geographies?.length ?? 0) > 0;
  const kpisComplete = programKpis.length > 0;
  const missing: string[] = [];
  if (!basicsComplete) missing.push("Basics");
  if (!audienceComplete) missing.push("Audience");
  if (!kpisComplete) missing.push("KPIs");
  const allComplete = missing.length === 0;
  const stepMap: Record<string, number> = { Basics: 1, Audience: 2, KPIs: 3 };

  const editBtnCls = "h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10";

  return (
    <div className="animate-fade-in space-y-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Review</h2>
        <p className="text-sm text-muted-foreground">Verify the programme spec, then publish.</p>
        <AudienceContextChip audience={audience} />
      </div>

      {allComplete ? (
        <Card className="p-3 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Ready to publish</div>
              <div className="text-xs text-emerald-900/80 dark:text-emerald-200/80">All required sections are configured. You can go live whenever you're ready.</div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-3 border-orange-500/40 bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-orange-900 dark:text-orange-200">Action needed</div>
              <div className="text-xs text-orange-900/80 dark:text-orange-200/80">
                Complete:{" "}
                {missing.map((m, i) => (
                  <span key={m}>
                    <button
                      type="button"
                      onClick={() => onEditStep?.(stepMap[m])}
                      disabled={!onEditStep}
                      className="font-semibold underline underline-offset-2 hover:text-orange-700 dark:hover:text-orange-100 disabled:no-underline disabled:cursor-default"
                    >
                      {m}
                    </button>
                    {i < missing.length - 1 ? ", " : ""}
                  </span>
                ))}{" "}
                before publishing.
              </div>
            </div>
          </div>
        </Card>
      )}

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

      {/* Programme basics — spacious summary grid */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Programme basics</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Summary brief</p>
          </div>
          {onEditStep && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-sm font-medium text-primary hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors"
              onClick={() => onEditStep(1)}
            >
              <Pencil size={14} /> Edit
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {[
            { label: "Name", value: basics.name || "—" },
            { label: "Period", value: basics.period },
            { label: "Month", value: q.full },
            { label: "Attainment basis", value: basics.attainmentBasis },
            { label: "Currency", value: basics.currency },
            { label: "Payout frequency", value: basics.payoutFrequency },
          ].map((f, i) => (
            <div
              key={f.label}
              className={cn(
                "px-6 py-5 group transition-colors hover:bg-muted/30",
                i < 4 && "border-b border-border",
                i % 2 === 0 && i < 5 && "sm:border-r border-border"
              )}
            >
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">
                {f.label}
              </div>
              <div className="text-base font-medium text-foreground truncate">{f.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Audience */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Audience</h3>
          {onEditStep && (
            <Button variant="ghost" size="sm" className={editBtnCls} onClick={() => onEditStep(2)}>
              <Pencil size={12} /> Edit
            </Button>
          )}
        </div>
        <div className="space-y-1 text-xs">
          <div><span className="text-muted-foreground">Role: </span>{audience.roles[0] || "—"}</div>
          <div><span className="text-muted-foreground">Geography: </span>{audience.geographies.join(", ") || "—"}</div>
        </div>
      </Card>

      {/* KPIs — payout summary with expandable rows */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold">KPIs ({programKpis.length})</h3>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Badge variant="outline" className="text-[10px]">Month-end {fmt(monthlyTotal)}</Badge>
            <Badge variant="outline" className="text-[10px]">Quarter-end {fmt(quarterlyTotal)}</Badge>
            <Badge className="text-[10px]">Total {fmt(total)}</Badge>
            {onEditStep && (
              <Button variant="ghost" size="sm" className={editBtnCls} onClick={() => onEditStep(3)}>
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
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{kpiDisplayName(k.templateId, k.customName)}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {k.customName?.trim() ? <span className="mr-1">{tpl.meta.name} ·</span> : null}
                        {tpl.summarize(k.config)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
            <WizardAddButton variant="outline" onClick={onJumpToAddKpi}>
              Add KPI
            </WizardAddButton>
          </div>
        )}
      </Card>

      {/* Programme-level gates */}
      {(gates.length > 0 || onEditStep) && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Programme-level gates</h3>
            {onEditStep && (
              <Button variant="ghost" size="sm" className={editBtnCls} onClick={() => onEditStep(4)}>
                <Pencil size={12} /> Edit
              </Button>
            )}
          </div>
          {gates.length > 0 ? (
            <div className="text-xs">
              <Badge variant="outline" className="text-[10px] mr-2">{gates.length} rule{gates.length > 1 ? "s" : ""}</Badge>
              <span className="text-muted-foreground">configured</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No gates configured.</p>
          )}
        </Card>
      )}

      <p className="text-xs text-center text-muted-foreground">
        {allComplete
          ? "Review the sections above, then publish with Go Live."
          : `Complete ${missing.join(", ")} to enable publishing.`}
      </p>
    </div>
  );
}
