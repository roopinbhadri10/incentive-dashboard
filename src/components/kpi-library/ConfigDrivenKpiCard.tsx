// Generic, fully config-driven KPI editor card. Reads a KpiMeta (metadata + an
// ordered list of SectionSchema) and renders/binds every section. There are no
// per-KPI components — a new KPI is pure config (sections + a computeId).
//
// Bindings write into the KPI's existing config value object via path get/set,
// so the stored shape (consumed by rulePayload serialization) is unchanged.

import { useEffect, type ReactNode } from "react";
import { Plus, Trash2, AlertTriangle, Info, TrendingUp, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useControlled } from "./useControlled";
import { KeyNotesSection } from "./KeyNotesSection";
import { TargetSourceSelector } from "./TargetSourceSelector";
import { SlabsEditor } from "./SlabsEditor";
import { DbbProductSelector, DEFAULT_DBB_PRODUCTS } from "./DbbProductSelector";
import { GateKpiOptions } from "./GateKpiOptions";
import {
  LIBRARY_KPIS, uid,
  type GateCondition, type GateThresholdUnit, type NsvSlab, type StepMode,
} from "./nsvTypes";
import { COMPUTE_REGISTRY } from "./schema/computeRegistry";
import { getPath, setPath } from "./schema/path";
import type {
  KpiMeta, SectionSchema, Field, VisibleWhen,
  AiRecoSection, GatesSection, SlabsSection,
} from "./schema/kpiSchema";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Literal classes so Tailwind's JIT scanner picks them up.
const GRID_COLS: Record<number, string> = {
  1: "grid gap-3 grid-cols-1",
  2: "grid gap-3 grid-cols-1 md:grid-cols-2",
  3: "grid gap-3 grid-cols-1 md:grid-cols-3",
};

export interface ConfigDrivenKpiCardProps {
  meta: KpiMeta;
  tag: string;
  value?: unknown;
  onChange?: (v: unknown) => void;
  lockedRole?: "mr" | "aso";
  hideRoleSelector?: boolean;
}

type Cfg = Record<string, unknown>;
type SetCfg = (next: Cfg | ((p: Cfg) => Cfg)) => void;

// ── Visibility ───────────────────────────────────────────────────────────────
function passes(cond: VisibleWhen, cfg: unknown): boolean {
  const v = getPath(cfg, cond.path);
  if (cond.equals !== undefined) return v === cond.equals;
  if (cond.in !== undefined) return cond.in.includes(v);
  if (cond.truthy !== undefined) return cond.truthy ? !!v : !v;
  return true;
}
function visible(cond: VisibleWhen | VisibleWhen[] | undefined, cfg: unknown): boolean {
  if (!cond) return true;
  return (Array.isArray(cond) ? cond : [cond]).every((c) => passes(c, cfg));
}

// ── Single field control ─────────────────────────────────────────────────────
function FieldControl({ field, cfg, setCfg }: { field: Field; cfg: Cfg; setCfg: SetCfg }) {
  if (!visible(field.visibleWhen, cfg)) return null;
  const raw = getPath(cfg, field.path);
  const set = (v: unknown) => setCfg((c) => setPath(c, field.path, v) as Cfg);

  let control: ReactNode;
  switch (field.kind) {
    case "switch":
      control = (
        <div className="flex items-center gap-2">
          <Switch checked={!!raw} onCheckedChange={(v) => set(v)} />
          <span className="text-sm text-muted-foreground">
            {raw ? field.onLabel ?? "On" : field.offLabel ?? "Off"}
          </span>
        </div>
      );
      break;
    case "number":
      control = (
        <div className="flex items-center gap-1.5">
          {field.prefix && <span className="text-xs text-muted-foreground">{field.prefix}</span>}
          <Input
            type="number"
            value={(raw as number) ?? 0}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(e) => set(Number(e.target.value))}
            className="h-8 w-28"
          />
          {field.suffix && <span className="text-xs text-muted-foreground">{field.suffix}</span>}
        </div>
      );
      break;
    case "text":
      control = (
        <Input
          value={(raw as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => set(e.target.value)}
          className="h-8 w-40 text-sm"
        />
      );
      break;
    case "textarea":
      control = (
        <textarea
          value={(raw as string) ?? ""}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          onChange={(e) => set(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      );
      break;
    case "select":
      control = (
        <Select value={(raw as string) ?? ""} onValueChange={(v) => set(v)}>
          <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "segmented":
      control = (
        <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5 flex-wrap">
          {field.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => set(o.value)}
              className={`px-3 py-1.5 text-xs rounded-sm transition ${
                raw === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
      break;
  }

  if (field.inline) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {field.label && <Label className="text-xs text-muted-foreground">{field.label}</Label>}
        {control}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {field.label && <Label className="text-[11px] text-muted-foreground">{field.label}</Label>}
      {control}
      {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
    </div>
  );
}

// ── Earning ladder preview ───────────────────────────────────────────────────
function EarningLadder({ steps }: { steps: { label: string; value: number }[] }) {
  if (!steps.length) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center flex-wrap gap-1 text-sm">
        {steps.map((e, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="inline-flex flex-col items-center px-2 py-1 rounded bg-card border border-border min-w-[72px]">
              <span className="text-[10px] text-muted-foreground">{e.label}</span>
              <span className="text-sm font-semibold text-foreground">{fmt(e.value)}</span>
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Simple-slab table (Collection, PCC, …) ──────────────────────────────────
function SimpleSlabsTable({ section, cfg, setCfg }: { section: SlabsSection; cfg: Cfg; setCfg: SetCfg }) {
  const slabs = (getPath(cfg, section.path) as { threshold: number; payout: number }[]) ?? [];
  const unit = section.unitFromPath ? (getPath(cfg, section.unitFromPath) as string) : "";
  const prefix = unit === "amount" ? "₹" : "";
  const suffix = unit === "pct" ? "%" : "";
  const setSlabs = (next: unknown) => setCfg((c) => setPath(c, section.path, next) as Cfg);
  const sorted = [...slabs].sort((a, b) => a.threshold - b.threshold);
  const dupes = (() => {
    const seen = new Map<number, number>();
    slabs.forEach((s) => seen.set(s.threshold, (seen.get(s.threshold) ?? 0) + 1));
    return [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t);
  })();
  const unsorted = slabs.some((s, i) => i > 0 && s.threshold <= slabs[i - 1].threshold);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => {
          const last = slabs[slabs.length - 1];
          const step = unit === "pct" ? 5 : Math.max(1, Math.round((last?.threshold ?? 1) * 0.1));
          setSlabs([...slabs, { threshold: (last?.threshold ?? 0) + step, payout: Math.round((last?.payout ?? 0) * 1.25) }]);
        }}>
          <Plus size={14} /> Add slab
        </Button>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <div>Threshold</div><div>Cumulative payout</div><div>Δ vs previous</div><div className="w-8" />
        </div>
        {slabs.map((s, i) => {
          const prev = i === 0 ? 0 : slabs[i - 1].payout;
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 border-t border-border items-center">
              <div className="flex items-center gap-2">
                {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
                <Input type="number" value={s.threshold}
                  onChange={(e) => setSlabs(slabs.map((x, j) => (j === i ? { ...x, threshold: Number(e.target.value) } : x)))}
                  className={`h-8 w-24 ${dupes.includes(s.threshold) ? "border-destructive" : ""}`} />
                <span className="text-xs text-muted-foreground">{suffix || section.unitLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">₹</span>
                <Input type="number" value={s.payout}
                  onChange={(e) => setSlabs(slabs.map((x, j) => (j === i ? { ...x, payout: Number(e.target.value) } : x)))}
                  className="h-8 w-28" />
              </div>
              <div className="text-xs text-muted-foreground">{i === 0 ? "Entry slab" : `+${fmt(s.payout - prev)} over previous`}</div>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={slabs.length <= 1}
                onClick={() => setSlabs(slabs.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </Button>
            </div>
          );
        })}
      </div>
      {(dupes.length > 0 || unsorted) && (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            {dupes.length > 0 && <div>Duplicate thresholds: {dupes.join(", ")}.</div>}
            {unsorted && <div>Thresholds must be strictly ascending.</div>}
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
                <span className="text-[10px] text-muted-foreground">{prefix}{s.threshold}{suffix}</span>
                <span className="text-sm font-semibold text-foreground">{fmt(s.payout)}</span>
              </span>
              {i < sorted.length - 1 && <span className="text-muted-foreground">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ECO outlet-count slab table ──────────────────────────────────────────────
function EcoSlabsTable({ section, cfg, setCfg }: { section: SlabsSection; cfg: Cfg; setCfg: SetCfg }) {
  const slabs = (getPath(cfg, section.path) as { count: number; ratePerOutlet: number }[]) ?? [];
  const setSlabs = (next: unknown) => setCfg((c) => setPath(c, section.path, next) as Cfg);
  const earnings = COMPUTE_REGISTRY.ecoLadder.ladder(cfg);
  const dupes = (() => {
    const seen = new Map<number, number>();
    slabs.forEach((s) => seen.set(s.count, (seen.get(s.count) ?? 0) + 1));
    return [...seen.entries()].filter(([, n]) => n > 1).map(([c]) => c);
  })();
  const unsorted = slabs.some((s, i) => i > 0 && s.count <= slabs[i - 1].count);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => {
          const last = slabs[slabs.length - 1];
          setSlabs([...slabs, { count: (last?.count ?? 150) + 25, ratePerOutlet: last?.ratePerOutlet ?? 2 }]);
        }}>
          <Plus size={14} /> Add slab
        </Button>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <div>Outlets billed</div><div>Rate (₹ per outlet)</div><div>Earning for this band</div><div className="w-8" />
        </div>
        {slabs.map((s, i) => {
          const prevCount = i === 0 ? 0 : slabs[i - 1].count;
          const delta = (s.count - prevCount) * s.ratePerOutlet;
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 border-t border-border items-center">
              <div className="flex items-center gap-2">
                <Input type="number" value={s.count}
                  onChange={(e) => setSlabs(slabs.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)))}
                  className={`h-8 w-24 ${dupes.includes(s.count) ? "border-destructive" : ""}`} />
                <span className="text-xs text-muted-foreground">outlets</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">₹</span>
                <Input type="number" value={s.ratePerOutlet}
                  onChange={(e) => setSlabs(slabs.map((x, j) => (j === i ? { ...x, ratePerOutlet: Number(e.target.value) } : x)))}
                  className="h-8 w-24" />
                <span className="text-xs text-muted-foreground">/ outlet</span>
              </div>
              <div className="text-xs text-foreground">From {prevCount} → {s.count} outlets · <span className="font-medium">{fmt(delta)}</span></div>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={slabs.length <= 2}
                onClick={() => setSlabs(slabs.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </Button>
            </div>
          );
        })}
      </div>
      {(dupes.length > 0 || unsorted) && (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            {dupes.length > 0 && <div>Duplicate outlet counts: {dupes.join(", ")}.</div>}
            {unsorted && <div>Slabs must be in ascending order.</div>}
          </div>
        </div>
      )}
      <EarningLadder steps={earnings} />
    </div>
  );
}

// ── Gate conditions ──────────────────────────────────────────────────────────
function GatesEditor({ section, cfg, setCfg, indexLabel }: { section: GatesSection; cfg: Cfg; setCfg: SetCfg; indexLabel: string }) {
  const enabled = !!getPath(cfg, section.enabledPath);
  const gates = (getPath(cfg, section.gatesPath) as GateCondition[]) ?? [];
  const noun = section.kpiNoun ?? "this KPI";
  const setEnabled = (v: boolean) =>
    setCfg((c) => setPath(setPath(c, section.enabledPath, v), section.gatesPath, v ? gates : []) as Cfg);
  const setGates = (next: GateCondition[]) => setCfg((c) => setPath(c, section.gatesPath, next) as Cfg);
  const updateGate = (id: string, patch: Partial<GateCondition>) =>
    setGates(gates.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const addGate = () => {
    const firstOther = LIBRARY_KPIS.find((k) => k.id !== section.selfId)!;
    setGates([...gates, {
      id: uid("gate"), dependsOnKpiId: firstOther.id,
      thresholdValue: firstOther.defaultUnit === "pct" ? 80 : 50,
      thresholdUnit: firstOther.defaultUnit, consequence: { kind: "zero" },
    }]);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {indexLabel}{section.title}
        </Label>
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-xs text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>

      {enabled && (
        <div className="space-y-3">
          {gates.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No gate conditions yet. Add one to make {noun} dependent on another KPI.
            </p>
          )}
          {gates.map((g) => (
            <div key={g.id} className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Dependent on KPI</Label>
                  <Select value={g.dependsOnKpiId} onValueChange={(v) => {
                    const k = LIBRARY_KPIS.find((x) => x.id === v)!;
                    updateGate(g.id, { dependsOnKpiId: v, thresholdUnit: k.defaultUnit });
                  }}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72"><GateKpiOptions excludeId={section.selfId} /></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Threshold</Label>
                  <Input type="number" value={g.thresholdValue}
                    onChange={(e) => updateGate(g.id, { thresholdValue: Number(e.target.value) })} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Unit</Label>
                  <Select value={g.thresholdUnit} onValueChange={(v) => updateGate(g.id, { thresholdUnit: v as GateThresholdUnit })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pct">% achievement</SelectItem>
                      <SelectItem value="amount">₹ amount</SelectItem>
                      <SelectItem value="count">Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGates(gates.filter((x) => x.id !== g.id))}>
                  <Trash2 size={14} />
                </Button>
              </div>

              {section.showCollectionBasis && g.dependsOnKpiId === "collection" && (
                <div className="flex items-center gap-2 pl-1">
                  <Label className="text-[11px] text-muted-foreground">Measured against</Label>
                  <div className="inline-flex rounded-md border bg-background p-0.5">
                    {(["gsv", "nsv"] as const).map((opt) => (
                      <button key={opt} type="button" onClick={() => updateGate(g.id, { collectionBasis: opt })}
                        className={`px-2.5 py-1 text-[11px] rounded-sm font-medium transition-colors ${
                          (g.collectionBasis ?? "nsv") === opt ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}>
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {section.showConsequence && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">If not met, consequence</Label>
                    <Select value={g.consequence.kind}
                      onValueChange={(v) => updateGate(g.id, { consequence: v === "zero" ? { kind: "zero" } : { kind: "limit", pct: 50 } })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zero">Zero out {noun} payout</SelectItem>
                        <SelectItem value="limit">Limit {noun} earnings to X%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {g.consequence.kind === "limit" && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Limit to</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={g.consequence.pct}
                          onChange={(e) => updateGate(g.id, { consequence: { kind: "limit", pct: Number(e.target.value) } })}
                          className="h-8 w-28" />
                        <span className="text-xs text-muted-foreground">% of full {noun} payout</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addGate} className="gap-1"><Plus size={14} /> Add gate condition</Button>
        </div>
      )}
    </section>
  );
}

// ── AI Recommended Order sub-metric editor ───────────────────────────────────
function AiRecoEditor({ section, cfg, setCfg }: { section: AiRecoSection; cfg: Cfg; setCfg: SetCfg }) {
  return (
    <div className="space-y-5">
      {section.subMetrics.map((sm) => {
        const sub = getPath(cfg, sm.path) as {
          enabled: boolean; payoutBasis: string; complianceType: string;
          slabs: { threshold: number; payout: number }[];
          perLine: { ratePerLine: number; minLines: number; maxLines: number };
        };
        const setSub = (patch: Partial<typeof sub>) => setCfg((c) => setPath(c, sm.path, { ...sub, ...patch }) as Cfg);
        const perLineMax = sub.perLine.maxLines * sub.perLine.ratePerLine;
        const top = sub.slabs.reduce((m, x) => Math.max(m, x.payout), 0);
        const headerMax = sub.payoutBasis === "per_line" ? perLineMax : top;
        const Seg = ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
            {options.map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(o.value)}
                className={`px-3 py-1.5 text-xs rounded-sm transition ${value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {o.label}
              </button>
            ))}
          </div>
        );
        return (
          <div key={sm.path} className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-start justify-between px-4 py-3 bg-muted/30 border-b border-border gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">{sm.title}</h3>
                  <Badge variant="outline" className="text-[10px]">{sub.complianceType === "sku_only" ? "SKU compliance" : "SKU + Qty compliance"}</Badge>
                  <Badge variant="outline" className="text-[10px]">{sub.payoutBasis === "per_line" ? "Per-line payout" : "Monthly % compliance"}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sm.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">{sub.enabled ? `Max ${fmt(headerMax)}` : "Disabled"}</span>
                <Switch checked={sub.enabled} onCheckedChange={(v) => setSub({ enabled: v })} />
              </div>
            </div>
            {sub.enabled && (
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Compliance type</Label>
                  <Seg value={sub.complianceType} onChange={(v) => setSub({ complianceType: v })}
                    options={[{ value: "sku_only", label: "SKU only" }, { value: "sku_and_qty", label: "SKU + Qty (≥ recommended)" }]} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payout basis</Label>
                  <Seg value={sub.payoutBasis} onChange={(v) => setSub({ payoutBasis: v })}
                    options={[{ value: "monthly_pct", label: "Monthly % compliance" }, { value: "per_line", label: "Per-line ₹" }]} />
                </div>
                {sub.payoutBasis === "monthly_pct" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Slabs (% complied → ₹ payout)</Label>
                      <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
                        const last = sub.slabs[sub.slabs.length - 1];
                        setSub({ slabs: [...sub.slabs, { threshold: Math.min(100, (last?.threshold ?? 0) + 5), payout: Math.round((last?.payout ?? 0) * 1.25) }] });
                      }}><Plus size={12} /> Add slab</Button>
                    </div>
                    <div className="border border-border rounded-md overflow-hidden">
                      <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-3 py-2 bg-muted/40 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        <div>Threshold</div><div>Cumulative payout</div><div>Δ vs previous</div><div className="w-8" />
                      </div>
                      {sub.slabs.map((s, i) => {
                        const prev = i === 0 ? 0 : sub.slabs[i - 1].payout;
                        return (
                          <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-3 py-2 border-t border-border items-center">
                            <div className="flex items-center gap-2">
                              <Input type="number" value={s.threshold}
                                onChange={(e) => setSub({ slabs: sub.slabs.map((x, j) => (j === i ? { ...x, threshold: Number(e.target.value) } : x)) })} className="h-8 w-20" />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">₹</span>
                              <Input type="number" value={s.payout}
                                onChange={(e) => setSub({ slabs: sub.slabs.map((x, j) => (j === i ? { ...x, payout: Number(e.target.value) } : x)) })} className="h-8 w-28" />
                            </div>
                            <div className="text-xs text-muted-foreground">{i === 0 ? "Entry slab" : `+${fmt(s.payout - prev)} over previous`}</div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={sub.slabs.length <= 1}
                              onClick={() => setSub({ slabs: sub.slabs.filter((_, j) => j !== i) })}><Trash2 size={12} /></Button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Rate per complied line (₹)</Label>
                        <Input type="number" value={sub.perLine.ratePerLine}
                          onChange={(e) => setSub({ perLine: { ...sub.perLine, ratePerLine: Number(e.target.value) } })} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Min lines to earn</Label>
                        <Input type="number" value={sub.perLine.minLines}
                          onChange={(e) => setSub({ perLine: { ...sub.perLine, minLines: Number(e.target.value) } })} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Max lines (cap)</Label>
                        <Input type="number" value={sub.perLine.maxLines}
                          onChange={(e) => setSub({ perLine: { ...sub.perLine, maxLines: Number(e.target.value) } })} className="h-9" />
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                      Earn <span className="font-medium text-foreground">{fmt(sub.perLine.minLines * sub.perLine.ratePerLine)}</span> at {sub.perLine.minLines} complied lines,
                      capped at <span className="font-medium text-foreground">{fmt(perLineMax)}</span> at {sub.perLine.maxLines} lines.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── One section ──────────────────────────────────────────────────────────────
function SectionView({ section, num, cfg, setCfg }: { section: SectionSchema; num: number | null; cfg: Cfg; setCfg: SetCfg }) {
  const numLabel = num != null ? `${num} · ` : "";

  switch (section.kind) {
    case "target-source":
      return (
        <TargetSourceSelector
          index={num != null ? String(num) : undefined}
          title={section.title}
          sfaKey={section.sfaKey}
          basis={getPath(cfg, section.basisPath) as never}
          secondarySource={getPath(cfg, section.secondarySourcePath) as never}
          targetFileName={getPath(cfg, section.fileNamePath) as string | undefined}
          targetStatus={getPath(cfg, section.statusPath) as never}
          onChange={(next) => setCfg((c) => {
            let n = setPath(c, section.basisPath, next.basis);
            n = setPath(n, section.secondarySourcePath, next.secondarySource);
            n = setPath(n, section.fileNamePath, next.targetFileName);
            n = setPath(n, section.statusPath, next.targetStatus);
            return n as Cfg;
          })}
        />
      );
    case "slabs":
      if (section.variant === "nsv") {
        return (
          <SlabsEditor
            title={`${numLabel}${section.title ?? "Slabs"}`}
            pctColumnLabel={section.pctColumnLabel}
            slabs={(getPath(cfg, section.path) as NsvSlab[]) ?? []}
            mode={(section.modePath ? (getPath(cfg, section.modePath) as StepMode) : "stepup") ?? "stepup"}
            onSlabsChange={(slabs) => setCfg((c) => setPath(c, section.path, slabs) as Cfg)}
            onModeChange={(mode) => section.modePath && setCfg((c) => setPath(c, section.modePath!, mode) as Cfg)}
          />
        );
      }
      return (
        <section className="space-y-3">
          {section.title && <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{numLabel}{section.title}</Label>}
          {section.variant === "eco"
            ? <EcoSlabsTable section={section} cfg={cfg} setCfg={setCfg} />
            : <SimpleSlabsTable section={section} cfg={cfg} setCfg={setCfg} />}
        </section>
      );
    case "earning-ladder": {
      const steps = COMPUTE_REGISTRY[section.computeId].ladder(cfg);
      if (!steps.length) return null;
      return (
        <section className="space-y-2">
          {section.title && (
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <TrendingUp size={12} /> {numLabel}{section.title}
            </Label>
          )}
          <EarningLadder steps={steps} />
        </section>
      );
    }
    case "gates":
      return <GatesEditor section={section} cfg={cfg} setCfg={setCfg} indexLabel={numLabel} />;
    case "key-notes":
      return (
        <KeyNotesSection
          index={num != null ? num : undefined}
          notes={(getPath(cfg, section.path) as string[]) ?? []}
          onChange={(notes) => setCfg((c) => setPath(c, section.path, notes) as Cfg)}
        />
      );
    case "dbb-products":
      return (
        <section className="space-y-2">
          {section.title && <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{numLabel}{section.title}</Label>}
          <DbbProductSelector
            value={(getPath(cfg, section.path) as never) ?? DEFAULT_DBB_PRODUCTS}
            onChange={(v) => setCfg((c) => setPath(c, section.path, v) as Cfg)}
          />
        </section>
      );
    case "ai-reco":
      return <AiRecoEditor section={section} cfg={cfg} setCfg={setCfg} />;
    case "info":
      return (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info size={12} className="mt-0.5 shrink-0" /> {section.text}
        </p>
      );
    case "field-group":
      return (
        <section className="space-y-2">
          {section.title && <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{numLabel}{section.title}</Label>}
          <div className={section.columns ? GRID_COLS[section.columns] : "flex items-center gap-4 flex-wrap"}>
            {section.fields.map((f, i) => <FieldControl key={`${f.path}-${i}`} field={f} cfg={cfg} setCfg={setCfg} />)}
          </div>
          {section.note && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5"><Info size={12} className="mt-0.5 shrink-0" /> {section.note}</p>
          )}
        </section>
      );
  }
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function ConfigDrivenKpiCard({ meta, tag, value, onChange, lockedRole, hideRoleSelector }: ConfigDrivenKpiCardProps) {
  const [cfg, setCfg] = useControlled<Cfg>(value as Cfg | undefined, onChange as ((v: Cfg) => void) | undefined, structuredClone(meta.defaultConfig) as Cfg);

  // Coerce role when a locked role is supplied by the caller.
  const lockedCfgRole = lockedRole === "aso" ? "aso_ase" : lockedRole === "mr" ? "mr" : undefined;
  useEffect(() => {
    if (lockedCfgRole && getPath(cfg, "role") !== lockedCfgRole) setCfg((c) => setPath(c, "role", lockedCfgRole) as Cfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedCfgRole]);

  const header = COMPUTE_REGISTRY[meta.computeId].header(cfg);

  // Visible sections (respect visibleWhen + role-selector gating), with running
  // numbers assigned only to visible `numbered` sections.
  const sections = meta.sections.filter((s) => {
    if (s.onlyWithRoleSelector && hideRoleSelector) return false;
    return visible(s.visibleWhen, cfg);
  });
  let counter = 0;

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-muted/30">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">{meta.name}</h2>
            <Badge variant="secondary" className="text-[10px]">{tag}</Badge>
            {meta.cadenceLabel && (
              <Badge variant="outline" className="text-[10px] gap-1"><Lock size={10} /> {meta.cadenceLabel}</Badge>
            )}
            {meta.headerBadges?.filter((b) => b !== tag).map((b) => (
              <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">{meta.description}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{header.label}</div>
          <div className="text-lg font-semibold text-primary">{header.value}</div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {sections.map((s) => {
          const num = s.numbered ? ++counter : null;
          return <SectionView key={s.id} section={s} num={num} cfg={cfg} setCfg={setCfg} />;
        })}
      </div>
    </Card>
  );
}
