import { useMemo } from "react";
import { Plus, Trash2, AlertTriangle, Info, TrendingUp, Lock, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LIBRARY_KPIS,
  computeSlabEarnings,
  uid,
  validateNsv,
  type GateCondition,
  type GateThresholdUnit,
  type NsvSlab,
  type NsvTemplateConfig,
} from "./nsvTypes";
import { GateKpiOptions } from "./GateKpiOptions";
import { useControlled } from "./useControlled";
import { KeyNotesSection } from "./KeyNotesSection";

import { TargetSourceSelector } from "./TargetSourceSelector";
import { SlabsEditor } from "./SlabsEditor";

const DEFAULT_PHASING_KEY_NOTES = [
  "Rewards hitting a % of monthly target by the cut-off day.",
  "Slab-based bonus on top of monthly NSV.",
  "Zero payout if the full-month gate is not met.",
];

const SELF_ID = "phasing";
const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export interface PhasingConfig extends NsvTemplateConfig {
  cutoffDay: number; // day of month e.g. 20
}

export const DEFAULT_PHASING: PhasingConfig = {
  cutoffDay: 20,
  basis: "secondary",
  slabs: [
    { pct: 55, ratePerPct: 30, entryPayout: 450 },
    { pct: 65, ratePerPct: 30 },
    { pct: 70, ratePerPct: 38 },
    { pct: 75, ratePerPct: 38 },
  ],
  cap: { enabled: true, pct: 75 },
  gatesEnabled: true,
  gates: [
    {
      id: uid("gate"),
      dependsOnKpiId: "nsv",
      thresholdValue: 95,
      thresholdUnit: "pct",
      consequence: { kind: "zero" },
    },
  ],
  keyNotes: [...DEFAULT_PHASING_KEY_NOTES],
};

export function PhasingTemplateCard({ value, onChange }: { value?: PhasingConfig; onChange?: (v: PhasingConfig) => void } = {}) {
  const [cfg, setCfg] = useControlled<PhasingConfig>(value, onChange, DEFAULT_PHASING);

  const validation = useMemo(() => validateNsv(cfg), [cfg]);
  const earnings = useMemo(() => computeSlabEarnings(cfg.slabs, cfg.stepMode ?? "stepup"), [cfg.slabs, cfg.stepMode]);
  const totalAtTop = earnings.length ? earnings[earnings.length - 1].cumulative : 0;
  const entryEarning = earnings.length ? earnings[0].cumulative : 0;

  const updateSlab = (idx: number, patch: Partial<NsvSlab>) => {
    setCfg((c) => ({
      ...c,
      slabs: c.slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const addSlab = () => {
    setCfg((c) => {
      const last = c.slabs[c.slabs.length - 1];
      const nextPct = last ? last.pct + 5 : 60;
      const nextRate = last ? last.ratePerPct : 30;
      return { ...c, slabs: [...c.slabs, { pct: nextPct, ratePerPct: nextRate }] };
    });
  };

  const removeSlab = (idx: number) =>
    setCfg((c) => ({ ...c, slabs: c.slabs.filter((_, i) => i !== idx) }));

  const addGate = () => {
    const firstOther = LIBRARY_KPIS.find((k) => k.id !== SELF_ID)!;
    const gate: GateCondition = {
      id: uid("gate"),
      dependsOnKpiId: firstOther.id,
      thresholdValue: firstOther.defaultUnit === "pct" ? 80 : 50,
      thresholdUnit: firstOther.defaultUnit,
      consequence: { kind: "zero" },
    };
    setCfg((c) => ({ ...c, gatesEnabled: true, gates: [...c.gates, gate] }));
  };

  const updateGate = (id: string, patch: Partial<GateCondition>) =>
    setCfg((c) => ({
      ...c,
      gates: c.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));

  const removeGate = (id: string) =>
    setCfg((c) => ({ ...c, gates: c.gates.filter((g) => g.id !== id) }));

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-muted/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-foreground">Phasing Incentive</h2>
            <Badge variant="secondary" className="text-[10px]">In-Month Pacing</Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Lock size={10} /> Monthly payout
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Rewards achieving a % of the month's NSV target by a cut-off date.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max earning</div>
          <div className="text-lg font-semibold text-primary">{fmt(totalAtTop)}</div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 1. Cut-off date */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <CalendarDays size={12} /> 1 · Cut-off date
          </Label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Achieve % of month target by day</span>
            <Input
              type="number"
              min={1}
              max={31}
              value={cfg.cutoffDay}
              onChange={(e) => setCfg((c) => ({ ...c, cutoffDay: Number(e.target.value) }))}
              className="h-8 w-20"
            />
            <span className="text-sm text-muted-foreground">of the month</span>
          </div>
        </section>

        {/* 2. Basis */}
        <TargetSourceSelector
          index="2"
          title="Phasing Basis"
          sfaKey="phasing"
          basis={cfg.basis}
          secondarySource={cfg.secondarySource}
          targetFileName={cfg.targetFileName}
          targetStatus={cfg.targetStatus}
          onChange={(next) =>
            setCfg((c) => ({
              ...c,
              basis: next.basis,
              secondarySource: next.secondarySource,
              targetFileName: next.targetFileName,
              targetStatus: next.targetStatus,
            }))
          }
        />



        {/* 3. Slabs */}
        <SlabsEditor
          title={`3 · Slabs`}
          pctColumnLabel={`% of Month Target by day ${cfg.cutoffDay}`}
          slabs={cfg.slabs}
          mode={cfg.stepMode ?? "stepup"}
          onSlabsChange={(slabs) => setCfg((c) => ({ ...c, slabs }))}
          onModeChange={(stepMode) => setCfg((c) => ({ ...c, stepMode }))}
        />


        {/* 4. Earning preview */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <TrendingUp size={12} /> 4 · Earning potential across slabs
          </Label>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center flex-wrap gap-1 text-sm">
              {earnings.map((e, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="inline-flex flex-col items-center px-2 py-1 rounded bg-card border border-border min-w-[72px]">
                    <span className="text-[10px] text-muted-foreground">{e.pct}%</span>
                    <span className="text-sm font-semibold text-foreground">{fmt(e.cumulative)}</span>
                  </span>
                  {i < earnings.length - 1 && <span className="text-muted-foreground">→</span>}
                </span>
              ))}
            </div>
            {entryEarning > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                A rep earns <span className="font-medium text-foreground">{fmt(entryEarning)}</span> at the entry
                slab and up to <span className="font-medium text-foreground">{fmt(totalAtTop)}</span> at the top
                phasing slab.
              </p>
            )}
          </div>
        </section>

        {/* 5. Cap */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            5 · Cap (maximum payable achievement)
          </Label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={cfg.cap.enabled}
                onCheckedChange={(v) => setCfg((c) => ({ ...c, cap: { ...c.cap, enabled: v } }))}
              />
              <span className="text-sm">{cfg.cap.enabled ? "Cap enabled" : "No cap"}</span>
            </div>
            {cfg.cap.enabled && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Cap at</Label>
                <Input
                  type="number"
                  value={cfg.cap.pct}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, cap: { ...c.cap, pct: Number(e.target.value) } }))
                  }
                  className="h-8 w-24"
                />
                <span className="text-xs text-muted-foreground">% achievement</span>
              </div>
            )}
          </div>
          {cfg.cap.enabled && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 shrink-0" />
              Beyond {cfg.cap.pct}% achievement by day {cfg.cutoffDay}, no additional reward is offered.
            </p>
          )}
          {validation.capBelowTopSlab && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle size={12} /> Cap is below your top slab — top slabs will never pay out.
            </div>
          )}
        </section>

        {/* 6. Gate conditions (prefilled NSV ≥95%) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              6 · Gate conditions
            </Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={cfg.gatesEnabled}
                onCheckedChange={(v) =>
                  setCfg((c) => ({ ...c, gatesEnabled: v, gates: v ? c.gates : [] }))
                }
              />
              <span className="text-xs text-muted-foreground">
                {cfg.gatesEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          {cfg.gatesEnabled && (
            <div className="space-y-3">
              {cfg.gates.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No gate conditions yet. Add one to make Phasing dependent on another KPI.
                </p>
              )}

              {cfg.gates.map((g) => {
                const kpi = LIBRARY_KPIS.find((k) => k.id === g.dependsOnKpiId);
                return (
                  <div key={g.id} className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
                    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Dependent on KPI (full-month)</Label>
                        <Select
                          value={g.dependsOnKpiId}
                          onValueChange={(v) => {
                            const k = LIBRARY_KPIS.find((x) => x.id === v)!;
                            updateGate(g.id, { dependsOnKpiId: v, thresholdUnit: k.defaultUnit });
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            <GateKpiOptions excludeId={SELF_ID} />
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Threshold</Label>
                        <Input
                          type="number"
                          value={g.thresholdValue}
                          onChange={(e) => updateGate(g.id, { thresholdValue: Number(e.target.value) })}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Unit</Label>
                        <Select
                          value={g.thresholdUnit}
                          onValueChange={(v) => updateGate(g.id, { thresholdUnit: v as GateThresholdUnit })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pct">% achievement</SelectItem>
                            <SelectItem value="amount">₹ amount</SelectItem>
                            <SelectItem value="count">Count</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeGate(g.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">If not met, consequence</Label>
                        <Select
                          value={g.consequence.kind}
                          onValueChange={(v) =>
                            updateGate(g.id, {
                              consequence:
                                v === "zero" ? { kind: "zero" } : { kind: "limit", pct: 50 },
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zero">Zero out Phasing payout</SelectItem>
                            <SelectItem value="limit">Limit Phasing earnings to X%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {g.consequence.kind === "limit" && (
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Limit to</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={g.consequence.pct}
                              onChange={(e) =>
                                updateGate(g.id, {
                                  consequence: { kind: "limit", pct: Number(e.target.value) },
                                })
                              }
                              className="h-8 w-28"
                            />
                            <span className="text-xs text-muted-foreground">% of full Phasing payout</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded p-2">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>
                        At runtime, if <span className="font-medium">{kpi?.name}</span> is not configured in
                        the same programme, this gate rule will be nullified.
                      </span>
                    </div>
                  </div>
                );
              })}

              <Button variant="outline" size="sm" onClick={addGate} className="gap-1">
                <Plus size={14} /> Add gate condition
              </Button>
            </div>
          )}
        </section>

        <KeyNotesSection
          index={6}
          notes={cfg.keyNotes ?? DEFAULT_PHASING_KEY_NOTES}
          onChange={(keyNotes) => setCfg((c) => ({ ...c, keyNotes }))}
        />
      </div>
    </Card>
  );
}
