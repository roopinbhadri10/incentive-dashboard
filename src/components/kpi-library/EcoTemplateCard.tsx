import { useEffect, useMemo } from "react";
import { Plus, Trash2, AlertTriangle, Info, TrendingUp, Lock, Users } from "lucide-react";
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
  uid,
  type GateCondition,
  type GateThresholdUnit,
} from "./nsvTypes";
import { GateKpiOptions } from "./GateKpiOptions";
import { useControlled } from "./useControlled";
import { KeyNotesSection } from "./KeyNotesSection";

const DEFAULT_ECO_KEY_NOTES = [
  "Outlets billed ≥ the minimum bill value threshold count.",
  "Slab-based payout on outlet count (MR).",
  "ASO/ASE earn a rate × Avg MR earning under them.",
];

const SELF_ID = "eco";
const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type RoleMode = "mr" | "aso_ase";
type MinBillMode =
  | "per_bill"
  | "cumulative_daily"
  | "cumulative_weekly"
  | "cumulative_fortnightly"
  | "cumulative_monthly"
  | "per_visit"
  | "any_nonzero";

const MIN_BILL_MODE_OPTIONS: { value: MinBillMode; label: string; sentence: (amt: number) => string }[] = [
  { value: "per_bill", label: "Min value per bill", sentence: (a) => `has at least one bill of ≥ ₹${a} GSV` },
  { value: "per_visit", label: "Min value per visit", sentence: (a) => `is billed for ≥ ₹${a} GSV in a single visit` },
  { value: "cumulative_daily", label: "Min cumulative daily GSV", sentence: (a) => `crosses ₹${a} cumulative GSV in a day` },
  { value: "cumulative_weekly", label: "Min cumulative weekly GSV", sentence: (a) => `crosses ₹${a} cumulative GSV in a week` },
  { value: "cumulative_fortnightly", label: "Min cumulative fortnightly GSV", sentence: (a) => `crosses ₹${a} cumulative GSV in a fortnight` },
  { value: "cumulative_monthly", label: "Min cumulative monthly GSV", sentence: (a) => `crosses ₹${a} cumulative GSV in the month` },
  { value: "any_nonzero", label: "Any non-zero billing", sentence: () => `has any non-zero billing` },
];

interface EcoSlab {
  // Outlet count threshold (e.g. 150, 200, 225, 250)
  count: number;
  // ₹ per additional outlet beyond previous slab
  ratePerOutlet: number;
}


export interface EcoConfig {
  role: RoleMode;
  minBillEnabled: boolean; // when false → any non-zero billing qualifies
  minBillMode: MinBillMode;
  minBillAmount: number;
  // MR-only
  slabs: EcoSlab[];
  // ASO/ASE-only
  rateMultiplier: number; // e.g. 3 → 3 × Avg MR earning
  doubleBillingCountsTwice: boolean;
  cap: { enabled: boolean; outlets: number };
  gatesEnabled: boolean;
  gates: GateCondition[];
  keyNotes?: string[];
}

export const DEFAULT_ECO: EcoConfig = {
  role: "mr",
  minBillEnabled: true,
  minBillMode: "per_bill",
  minBillAmount: 250,
  slabs: [
    { count: 150, ratePerOutlet: 2 },
    { count: 200, ratePerOutlet: 2 },
    { count: 225, ratePerOutlet: 2 },
    { count: 250, ratePerOutlet: 2 },
  ],
  rateMultiplier: 3,
  doubleBillingCountsTwice: false,
  cap: { enabled: true, outlets: 300 },
  gatesEnabled: false,
  gates: [],
  keyNotes: [...DEFAULT_ECO_KEY_NOTES],
};

function computeEcoEarnings(slabs: EcoSlab[]) {
  const out: Array<{ count: number; delta: number; cumulative: number }> = [];
  let cum = 0;
  for (let i = 0; i < slabs.length; i++) {
    const prevCount = i === 0 ? 0 : slabs[i - 1].count;
    const delta = (slabs[i].count - prevCount) * slabs[i].ratePerOutlet;
    cum += delta;
    out.push({ count: slabs[i].count, delta, cumulative: cum });
  }
  return out;
}

export function EcoTemplateCard({ value, onChange, lockedRole, hideRoleSelector }: { value?: EcoConfig; onChange?: (v: EcoConfig) => void; lockedRole?: "mr" | "aso"; hideRoleSelector?: boolean } = {}) {
  const [cfg, setCfg] = useControlled<EcoConfig>(value, onChange, DEFAULT_ECO);
  const lockedCfgRole: RoleMode | undefined = lockedRole === "aso" ? "aso_ase" : lockedRole === "mr" ? "mr" : undefined;
  // The "1 · Role" section is hidden when hideRoleSelector is set (wizard view),
  // so the remaining sections renumber from 1 instead of starting at 2.
  const secBase = hideRoleSelector ? 0 : 1;
  useEffect(() => {
    if (lockedCfgRole && cfg.role !== lockedCfgRole) setCfg((c) => ({ ...c, role: lockedCfgRole }));
  }, [lockedCfgRole]);

  const earnings = useMemo(() => computeEcoEarnings(cfg.slabs), [cfg.slabs]);
  const totalAtTop = earnings.length ? earnings[earnings.length - 1].cumulative : 0;
  const entryEarning = earnings.length ? earnings[0].cumulative : 0;

  const duplicateCounts = useMemo(() => {
    const seen = new Map<number, number>();
    cfg.slabs.forEach((s) => seen.set(s.count, (seen.get(s.count) ?? 0) + 1));
    return [...seen.entries()].filter(([, n]) => n > 1).map(([c]) => c);
  }, [cfg.slabs]);
  const unsorted = cfg.slabs.some((s, i) => i > 0 && s.count <= cfg.slabs[i - 1].count);

  const updateSlab = (idx: number, patch: Partial<EcoSlab>) =>
    setCfg((c) => ({ ...c, slabs: c.slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));
  const addSlab = () =>
    setCfg((c) => {
      const last = c.slabs[c.slabs.length - 1];
      return {
        ...c,
        slabs: [...c.slabs, { count: (last?.count ?? 150) + 25, ratePerOutlet: last?.ratePerOutlet ?? 2 }],
      };
    });
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
    setCfg((c) => ({ ...c, gates: c.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  const removeGate = (id: string) =>
    setCfg((c) => ({ ...c, gates: c.gates.filter((g) => g.id !== id) }));

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-muted/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-foreground">ECO — Effective Coverage</h2>
            <Badge variant="secondary" className="text-[10px]">Coverage</Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Lock size={10} /> Monthly payout
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Lock size={10} /> Bill value: GSV
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Outlets billed ≥ the minimum bill value threshold.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {cfg.role === "mr" ? "Max earning" : "Formula"}
          </div>
          <div className="text-lg font-semibold text-primary">
            {cfg.role === "mr"
              ? fmt(totalAtTop)
              : `${cfg.rateMultiplier} × Avg MR earning`}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 1. Role mode */}
        {!hideRoleSelector && (
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Users size={12} /> 1 · Role this template configures
            </Label>
            <div className="flex items-center gap-3">
              {lockedCfgRole ? (
                <Badge variant="outline" className="text-xs gap-1"><Lock size={10} />
                  {cfg.role === "mr" ? "MR — slab-based earning" : "ASO / ASE — Rate × Avg MR earning"}
                </Badge>
              ) : (
                <Select value={cfg.role} onValueChange={(v) => setCfg((c) => ({ ...c, role: v as RoleMode }))}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mr">MR — slab-based earning</SelectItem>
                    <SelectItem value="aso_ase">ASO / ASE — Rate × Avg MR earning</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                {cfg.role === "mr"
                  ? "Earning is computed from outlet-count slabs."
                  : "Earning is derived from the MRs that report to this manager."}
              </p>
            </div>
          </section>
        )}

        {/* 2. Min bill value */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {1 + secBase} · Minimum bill value threshold
            </Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={cfg.minBillEnabled}
                onCheckedChange={(v) => setCfg((c) => ({ ...c, minBillEnabled: v }))}
              />
              <span className="text-xs text-muted-foreground">
                {cfg.minBillEnabled ? "Threshold enabled" : "Any non-zero billing qualifies"}
              </span>
            </div>
          </div>

          {cfg.minBillEnabled ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={cfg.minBillMode}
                  onValueChange={(v) => setCfg((c) => ({ ...c, minBillMode: v as MinBillMode }))}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MIN_BILL_MODE_OPTIONS.filter((o) => o.value !== "any_nonzero").map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    value={cfg.minBillAmount}
                    onChange={(e) => setCfg((c) => ({ ...c, minBillAmount: Number(e.target.value) }))}
                    className="h-8 w-28"
                  />
                  <span className="text-xs text-muted-foreground">GSV</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info size={12} className="mt-0.5 shrink-0" />
                An outlet counts toward ECO only when it{" "}
                {(MIN_BILL_MODE_OPTIONS.find((o) => o.value === cfg.minBillMode) ?? MIN_BILL_MODE_OPTIONS[0]).sentence(cfg.minBillAmount)}
                .
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 shrink-0" />
              Any outlet with non-zero billing in the period counts toward ECO — no value threshold applied.
            </p>
          )}
        </section>

        {/* 3. Earning config — role aware */}
        {cfg.role === "mr" ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {2 + secBase} · Outlet-count slabs (MR)
              </Label>
              <Button variant="outline" size="sm" onClick={addSlab} className="gap-1">
                <Plus size={14} /> Add slab
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <div>Outlets billed</div>
                <div>Rate (₹ per outlet)</div>
                <div>Earning for this band</div>
                <div className="w-8" />
              </div>
              {cfg.slabs.map((s, i) => {
                const band = earnings[i];
                const prevCount = i === 0 ? null : cfg.slabs[i - 1].count;
                const isDup = duplicateCounts.includes(s.count);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 border-t border-border items-center"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={s.count}
                        onChange={(e) => updateSlab(i, { count: Number(e.target.value) })}
                        className={`h-8 w-24 ${isDup ? "border-destructive" : ""}`}
                      />
                      <span className="text-xs text-muted-foreground">outlets</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        value={s.ratePerOutlet}
                        onChange={(e) => updateSlab(i, { ratePerOutlet: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                      <span className="text-xs text-muted-foreground">/ outlet</span>
                    </div>
                    <div className="text-xs text-foreground">
                      <span>
                        From {i === 0 ? 0 : prevCount} → {s.count} outlets ·{" "}
                        <span className="font-medium">{fmt(band.delta)}</span>
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeSlab(i)}
                      disabled={cfg.slabs.length <= 2}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                );
              })}
            </div>

            {(duplicateCounts.length > 0 || unsorted) && (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div>
                  {duplicateCounts.length > 0 && (
                    <div>Duplicate outlet counts: {duplicateCounts.join(", ")}. Each slab must be unique.</div>
                  )}
                  {unsorted && <div>Slabs must be in ascending order.</div>}
                </div>
              </div>
            )}

            {/* Earning preview */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-2">
                <TrendingUp size={12} /> Earning potential across slabs
              </Label>
              <div className="flex items-center flex-wrap gap-1 text-sm">
                {earnings.map((e, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="inline-flex flex-col items-center px-2 py-1 rounded bg-card border border-border min-w-[72px]">
                      <span className="text-[10px] text-muted-foreground">{e.count}</span>
                      <span className="text-sm font-semibold text-foreground">{fmt(e.cumulative)}</span>
                    </span>
                    {i < earnings.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
              {entryEarning > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  An MR earns <span className="font-medium text-foreground">{fmt(entryEarning)}</span> at the entry
                  slab and up to <span className="font-medium text-foreground">{fmt(totalAtTop)}</span> at the top.
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {2 + secBase} · Earning formula (ASO / ASE)
            </Label>
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Earning =</span>
                <Input
                  type="number"
                  value={cfg.rateMultiplier}
                  onChange={(e) => setCfg((c) => ({ ...c, rateMultiplier: Number(e.target.value) }))}
                  className="h-9 w-20"
                />
                <span className="text-muted-foreground">× Avg MR earning (from this manager's reportees)</span>
              </div>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info size={12} className="mt-0.5 shrink-0" />
                The actual rupee value resolves at runtime from the average MR ECO earning under this ASO/ASE.
              </p>
            </div>
          </section>
        )}

        {/* 4. Double billing toggle */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {3 + secBase} · Same-day double billing
          </Label>
          <div className="flex items-center gap-3">
            <Switch
              checked={cfg.doubleBillingCountsTwice}
              onCheckedChange={(v) => setCfg((c) => ({ ...c, doubleBillingCountsTwice: v }))}
            />
            <span className="text-sm">
              {cfg.doubleBillingCountsTwice
                ? "Same-day double billing counts as two events"
                : "Same-day double billing counts as one event"}
            </span>
          </div>
        </section>

        {/* 5. Cap (MR only) */}
        {cfg.role === "mr" && (
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {4 + secBase} · Cap (maximum payable outlets)
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
                    value={cfg.cap.outlets}
                    onChange={(e) =>
                      setCfg((c) => ({ ...c, cap: { ...c.cap, outlets: Number(e.target.value) } }))
                    }
                    className="h-8 w-24"
                  />
                  <span className="text-xs text-muted-foreground">outlets</span>
                </div>
              )}
            </div>
            {cfg.cap.enabled && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info size={12} className="mt-0.5 shrink-0" />
                Beyond {cfg.cap.outlets} outlets, no additional reward is offered.
              </p>
            )}
          </section>
        )}

        {/* 6. Gate conditions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {(cfg.role === "mr" ? 5 : 4) + secBase} · Gate conditions
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
                  No gate conditions yet. Add one to make ECO dependent on another KPI.
                </p>
              )}

              {cfg.gates.map((g) => (
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
                            consequence: v === "zero" ? { kind: "zero" } : { kind: "limit", pct: 50 },
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zero">Zero this KPI</SelectItem>
                          <SelectItem value="limit">Limit this KPI to X% of max</SelectItem>
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
                              updateGate(g.id, { consequence: { kind: "limit", pct: Number(e.target.value) } })
                            }
                            className="h-8 w-24"
                          />
                          <span className="text-xs text-muted-foreground">% of full payout</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={addGate} className="gap-1">
                <Plus size={14} /> Add gate condition
              </Button>
            </div>
          )}
        </section>

        <KeyNotesSection
          notes={cfg.keyNotes ?? DEFAULT_ECO_KEY_NOTES}
          onChange={(keyNotes) => setCfg((c) => ({ ...c, keyNotes }))}
        />
      </div>
    </Card>
  );
}
