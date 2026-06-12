import { useMemo, type ReactNode } from "react";
import { Plus, Trash2, AlertTriangle, Info, TrendingUp, Lock } from "lucide-react";
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
import { useControlled } from "./useControlled";
import { KeyNotesSection } from "./KeyNotesSection";

import { TargetSourceSelector } from "./TargetSourceSelector";
import { SlabsEditor } from "./SlabsEditor";
import { DEFAULT_NSV_KEY_NOTES } from "./nsvTypes";
import { GateKpiOptions } from "./GateKpiOptions";
import {
  DEFAULT_NSV,
  LIBRARY_KPIS,
  computeSlabEarnings,
  uid,
  validateNsv,
  type GateCondition,
  type GateThresholdUnit,
  type NsvSlab,
  type NsvTemplateConfig,
} from "./nsvTypes";

const SELF_ID = "nsv";
const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export interface NsvCardOverrides {
  selfId?: string;             // used for gate-exclude
  title?: string;              // header title
  description?: string;        // header subtitle
  cadenceLabel?: string;       // "Monthly payout" / "Quarterly payout"
  extraHeaderBadges?: ReactNode;
  basisTitle?: string;         // TargetSourceSelector title (e.g. "Quarterly NSV Basis")
  basisSfaKey?: string;        // TargetSourceSelector sfaKey
  kpiNoun?: string;            // "NSV" / "Quarterly NSV" — used in copy
  maxEarningLabel?: string;    // "Max earning" / "Max quarterly earning"
  defaultKeyNotes?: string[];
  footer?: ReactNode;
}

interface NsvCardProps extends NsvCardOverrides {
  value?: NsvTemplateConfig;
  onChange?: (v: NsvTemplateConfig) => void;
}

export function NsvTemplateCard({
  value,
  onChange,
  selfId = SELF_ID,
  title = "NSV — Net Sales Value",
  description = "Monthly net sales vs target.",
  cadenceLabel = "Monthly payout",
  extraHeaderBadges,
  basisTitle = "NSV Basis",
  basisSfaKey = "nsv",
  kpiNoun = "NSV",
  maxEarningLabel = "Max earning",
  defaultKeyNotes,
  footer,
}: NsvCardProps = {}) {
  const [cfg, setCfg] = useControlled<NsvTemplateConfig>(value, onChange, DEFAULT_NSV);

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
      const nextPct = last ? last.pct + 5 : 100;
      const nextRate = last ? last.ratePerPct : 200;
      return { ...c, slabs: [...c.slabs, { pct: nextPct, ratePerPct: nextRate }] };
    });
  };

  const removeSlab = (idx: number) =>
    setCfg((c) => ({ ...c, slabs: c.slabs.filter((_, i) => i !== idx) }));

  const addGate = () => {
    const firstOther = LIBRARY_KPIS.find((k) => k.id !== selfId)!;
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
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-muted/30">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <Badge variant="secondary" className="text-[10px]">Sales Volume</Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Lock size={10} /> {cadenceLabel}
            </Badge>
            {extraHeaderBadges}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{maxEarningLabel}</div>
          <div className="text-lg font-semibold text-primary">{fmt(totalAtTop)}</div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── 1. Basis ──────────────────────────────────────────────────── */}
        <TargetSourceSelector
          index="1"
          title={basisTitle}
          sfaKey={basisSfaKey}
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



        {/* ── 2. Slabs ──────────────────────────────────────────────────── */}
        <SlabsEditor
          title="2 · Slabs"
          slabs={cfg.slabs}
          mode={cfg.stepMode ?? "stepup"}
          onSlabsChange={(slabs) => setCfg((c) => ({ ...c, slabs }))}
          onModeChange={(stepMode) => setCfg((c) => ({ ...c, stepMode }))}
        />


        {/* ── 3. Earning potential preview ──────────────────────────────── */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <TrendingUp size={12} /> 3 · Earning potential across slabs
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
                A rep earns <span className="font-medium text-foreground">{fmt(entryEarning)}</span> at the first
                paid slab and can reach <span className="font-medium text-foreground">{fmt(totalAtTop)}</span> at
                the top.
              </p>
            )}
          </div>
        </section>

        {/* ── 4. Cap ────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            4 · Cap (maximum payable achievement)
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
              Beyond {cfg.cap.pct}% achievement, no additional reward is offered no matter how far the limit
              is exceeded.
            </p>
          )}
          {validation.capBelowTopSlab && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle size={12} /> Cap is below your top slab — top slabs will never pay out.
            </div>
          )}
        </section>

        {/* ── 5. Gate conditions ────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              5 · Gate conditions
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
                  No gate conditions yet. Add one to make {kpiNoun} dependent on another KPI.
                </p>
              )}

              {cfg.gates.map((g) => {
                const kpi = LIBRARY_KPIS.find((k) => k.id === g.dependsOnKpiId);
                return (
                  <div key={g.id} className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
                    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Dependent on KPI</Label>
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
                            <GateKpiOptions excludeId={selfId} />
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

                    {g.dependsOnKpiId === "collection" && (
                      <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                        <div className="flex items-start gap-2 text-[11px]">
                          <Lock size={12} className="mt-0.5 shrink-0 text-primary" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">GT Collection basis:</span>
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                Primary
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">
                              {cfg.basis === "primary"
                                ? "NSV basis is Primary, so GT Collection is measured on Primary billing (matches NSV)."
                                : "NSV basis is Secondary, but GT Collection is always measured on Primary billing — collection happens against primary invoices to distributors."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pl-5">
                          <Label className="text-[11px] text-muted-foreground">Measured against</Label>
                          <div className="inline-flex rounded-md border bg-background p-0.5">
                            {(["gsv", "nsv"] as const).map((opt) => {
                              const active = (g.collectionBasis ?? "nsv") === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => updateGate(g.id, { collectionBasis: opt })}
                                  className={`px-2.5 py-1 text-[11px] rounded-sm font-medium transition-colors ${
                                    active
                                      ? "bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {opt.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Collection % = Collected ÷ {(g.collectionBasis ?? "nsv").toUpperCase()} billed
                          </span>
                        </div>
                      </div>
                    )}

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
                            <SelectItem value="zero">Zero out {kpiNoun} payout</SelectItem>
                            <SelectItem value="limit">Limit {kpiNoun} earnings to X%</SelectItem>
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
                            <span className="text-xs text-muted-foreground">% of full {kpiNoun} payout</span>
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

        {footer}

        <KeyNotesSection
          index={6}
          notes={cfg.keyNotes ?? defaultKeyNotes ?? DEFAULT_NSV_KEY_NOTES}
          onChange={(keyNotes) => setCfg((c) => ({ ...c, keyNotes }))}
        />
      </div>
    </Card>
  );
}
