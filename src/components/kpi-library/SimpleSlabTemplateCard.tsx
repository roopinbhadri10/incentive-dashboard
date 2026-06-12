// Generic single-role slab KPI template card.
// Used by several FMCG KPIs (Collection %, Range Selling %, PCC, Call Compliance,
// New Outlets Added, Must-Sell SKU, ULPO, etc.) that share the same shape:
//   "When this metric crosses threshold X, the rep earns ₹Y", optionally with
//   ascending slabs that step up, an optional cap, and gate conditions.

import { useMemo } from "react";
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
import { GateKpiOptions } from "./GateKpiOptions";
import {
  LIBRARY_KPIS,
  uid,
  type GateCondition,
  type GateThresholdUnit,
} from "./nsvTypes";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type SlabUnit = "pct" | "count" | "amount";

export interface SimpleSlab {
  /** Threshold value at which the cumulative payout reaches `payout`. */
  threshold: number;
  /** Cumulative ₹ payout when threshold is achieved. */
  payout: number;
}

export interface SimpleSlabConfig {
  /** "pct" → "% achievement", "count" → integer units, "amount" → ₹ value. */
  unit: SlabUnit;
  /** Description of how the metric is sourced (informational, displayed as a badge). */
  dataFeed: "ai-ml" | "sfa" | "manual" | "upload";
  slabs: SimpleSlab[];
  cap: { enabled: boolean; value: number };
  gatesEnabled: boolean;
  gates: GateCondition[];
  keyNotes?: string[];
}

const DATA_FEED_LABEL: Record<SimpleSlabConfig["dataFeed"], string> = {
  "ai-ml": "Auto-feed",
  sfa: "SFA system",
  manual: "Manual entry",
  upload: "Monthly upload",
};

interface Props {
  selfId: string;
  title: string;
  tag: string;
  description: string;
  unitLabel: string; // e.g. "% achievement", "outlets", "calls / day"
  cadenceLabel?: string; // default Monthly payout
  defaultConfig: SimpleSlabConfig;
  defaultKeyNotes?: string[];
  value?: SimpleSlabConfig;
  onChange?: (v: SimpleSlabConfig) => void;
  hideRoleSelector?: boolean; // accepted but unused — keeps the contract uniform
}

export function makeSimpleSlabDefault(
  unit: SlabUnit,
  slabs: SimpleSlab[],
  opts: Partial<Omit<SimpleSlabConfig, "unit" | "slabs">> = {},
): SimpleSlabConfig {
  return {
    unit,
    dataFeed: opts.dataFeed ?? (unit === "pct" ? "sfa" : "sfa"),
    slabs,
    cap: opts.cap ?? { enabled: true, value: slabs[slabs.length - 1]?.threshold ?? 0 },
    gatesEnabled: opts.gatesEnabled ?? false,
    gates: opts.gates ?? [],
    keyNotes: opts.keyNotes,
  };
}

export function SimpleSlabTemplateCard({
  selfId,
  title,
  tag,
  description,
  unitLabel,
  cadenceLabel = "Monthly payout",
  defaultConfig,
  defaultKeyNotes,
  value,
  onChange,
}: Props) {
  const [cfg, setCfg] = useControlled<SimpleSlabConfig>(value, onChange, defaultConfig);

  const sorted = useMemo(
    () => [...cfg.slabs].sort((a, b) => a.threshold - b.threshold),
    [cfg.slabs],
  );
  const topPayout = sorted.length ? sorted[sorted.length - 1].payout : 0;
  const duplicates = useMemo(() => {
    const seen = new Map<number, number>();
    cfg.slabs.forEach((s) => seen.set(s.threshold, (seen.get(s.threshold) ?? 0) + 1));
    return [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t);
  }, [cfg.slabs]);
  const unsorted = cfg.slabs.some(
    (s, i) => i > 0 && s.threshold <= cfg.slabs[i - 1].threshold,
  );
  const nonMonotonicPayout = cfg.slabs.some(
    (s, i) => i > 0 && s.payout < cfg.slabs[i - 1].payout,
  );

  const updateSlab = (idx: number, patch: Partial<SimpleSlab>) =>
    setCfg((c) => ({
      ...c,
      slabs: c.slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  const addSlab = () =>
    setCfg((c) => {
      const last = c.slabs[c.slabs.length - 1];
      const step = c.unit === "pct" ? 5 : Math.max(1, Math.round((last?.threshold ?? 1) * 0.1));
      return {
        ...c,
        slabs: [
          ...c.slabs,
          {
            threshold: (last?.threshold ?? 0) + step,
            payout: Math.round((last?.payout ?? 0) * 1.25),
          },
        ],
      };
    });
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
    setCfg((c) => ({ ...c, gates: c.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  const removeGate = (id: string) =>
    setCfg((c) => ({ ...c, gates: c.gates.filter((g) => g.id !== id) }));

  const unitSuffix = cfg.unit === "pct" ? "%" : "";
  const unitPrefix = cfg.unit === "amount" ? "₹" : "";

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-muted/30">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <Badge variant="secondary" className="text-[10px]">{tag}</Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Lock size={10} /> {cadenceLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max earning</div>
          <div className="text-lg font-semibold text-primary">{fmt(topPayout)}</div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* 2 · Slabs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1 · Slabs ({unitLabel} → ₹ payout)
            </Label>
            <Button variant="outline" size="sm" onClick={addSlab} className="gap-1">
              <Plus size={14} /> Add slab
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <div>Threshold</div>
              <div>Cumulative payout</div>
              <div>Δ vs previous</div>
              <div className="w-8" />
            </div>
            {cfg.slabs.map((s, i) => {
              const isDup = duplicates.includes(s.threshold);
              const prev = i === 0 ? 0 : cfg.slabs[i - 1].payout;
              const delta = s.payout - prev;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 border-t border-border items-center"
                >
                  <div className="flex items-center gap-2">
                    {unitPrefix && <span className="text-xs text-muted-foreground">{unitPrefix}</span>}
                    <Input
                      type="number"
                      value={s.threshold}
                      onChange={(e) => updateSlab(i, { threshold: Number(e.target.value) })}
                      className={`h-8 w-24 ${isDup ? "border-destructive" : ""}`}
                    />
                    <span className="text-xs text-muted-foreground">{unitSuffix || unitLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      value={s.payout}
                      onChange={(e) => updateSlab(i, { payout: Number(e.target.value) })}
                      className="h-8 w-28"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i === 0 ? "Entry slab" : `+${fmt(delta)} over previous`}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeSlab(i)}
                    disabled={cfg.slabs.length <= 1}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            })}
          </div>

          {(duplicates.length > 0 || unsorted || nonMonotonicPayout) && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                {duplicates.length > 0 && (
                  <div>Duplicate thresholds: {duplicates.join(", ")}. Each slab must be unique.</div>
                )}
                {unsorted && <div>Thresholds must be strictly ascending.</div>}
                {nonMonotonicPayout && <div>Payout decreases at some slab — usually a mistake.</div>}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-2">
              <TrendingUp size={12} /> Earning ladder
            </Label>
            <div className="flex items-center flex-wrap gap-1 text-sm">
              {sorted.map((s, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="inline-flex flex-col items-center px-2 py-1 rounded bg-card border border-border min-w-[80px]">
                    <span className="text-[10px] text-muted-foreground">
                      {unitPrefix}{s.threshold}{unitSuffix}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{fmt(s.payout)}</span>
                  </span>
                  {i < sorted.length - 1 && <span className="text-muted-foreground">→</span>}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 3 · Cap */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            2 · Cap (maximum payable {unitLabel})
          </Label>
          <div className="flex items-center gap-4 flex-wrap">
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
                {unitPrefix && <span className="text-xs text-muted-foreground">{unitPrefix}</span>}
                <Input
                  type="number"
                  value={cfg.cap.value}
                  onChange={(e) => setCfg((c) => ({ ...c, cap: { ...c.cap, value: Number(e.target.value) } }))}
                  className="h-8 w-28"
                />
                <span className="text-xs text-muted-foreground">{unitSuffix || unitLabel}</span>
              </div>
            )}
          </div>
        </section>

        {/* 4 · Gates */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              3 · Gate conditions
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
                  No gate conditions yet. Add one to make this KPI dependent on another.
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
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={addGate} className="gap-1">
                <Plus size={14} /> Add gate condition
              </Button>
            </div>
          )}
        </section>

        <KeyNotesSection
          index={5}
          notes={cfg.keyNotes ?? defaultKeyNotes ?? []}
          onChange={(keyNotes) => setCfg((c) => ({ ...c, keyNotes }))}
        />
      </div>
    </Card>
  );
}

export function simpleSlabMaxPayout(c: SimpleSlabConfig): number {
  if (!c.slabs.length) return 0;
  return [...c.slabs].sort((a, b) => a.threshold - b.threshold).at(-1)!.payout;
}
