import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ShieldCheck, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import type { GateRule, GateCondition, GateConsequence, KpiItem, GateOperator, TerritoryFilter, AudienceV2State } from "../builderState";
import { uid } from "../builderState";
import { AudienceContextChip } from "../AudienceContextChip";
import { WizardAddButton } from "../ui/WizardAddButton";
import {
  fetchConsequenceOptions,
  type MetricGroups, type ConsequenceOptions, type ConsequenceOption,
} from "@/lib/saleshubApi";
import { GateMetricOptions, useMetricGroups, firstMetricValue, NSV_METRIC_VALUE, nsvMetricLabel } from "@/components/kpi-library/GateMetricOptions";

const TERRITORY_LABEL: Record<TerritoryFilter, string> = {
  all: "All days",
  urban: "Urban working days only",
  rural: "Rural working days only",
};

const TERRITORY_SHORT: Record<TerritoryFilter, string> = {
  all: "",
  urban: " on Urban days",
  rural: " on Rural days",
};

// Gate codes (metric identifiers) where a territory split (urban/rural working
// days) is meaningful. Keyed on the config gate code, not the display name.
const TERRITORY_SPLIT_METRICS = new Set<string>([
  "CFT_HOURS",
  "FIELD_ATTENDANCE_DAYS",
]);

// Default unit suggestion for HHD-sourced field-activity metrics, keyed on gate code.
const FIELD_ACTIVITY_DEFAULTS: Record<string, string> = {
  CFT_HOURS: "hours",
  FIELD_ATTENDANCE_DAYS: "days",
};

interface Props {
  value: GateRule[];
  onChange: (v: GateRule[]) => void;
  kpis: KpiItem[];
  audience?: AudienceV2State;
}

const OPERATORS: { id: GateOperator; label: string }[] = [
  { id: "lt", label: "is less than" },
  { id: "gt", label: "is greater than" },
  { id: "eq", label: "equals" },
  { id: "between", label: "is between" },
];

const opLabel = (o: GateOperator) => OPERATORS.find((x) => x.id === o)?.label || o;

// A blank condition preselects the first metric the config actually offers.
// Hardcoding one (e.g. attendance/ABSENT_DAYS) leaves the picker rendering empty
// whenever that code is absent from the loaded catalog.
export const blankCondition = (metricGroups: MetricGroups): GateCondition => {
  const [metricGroup = "", ...rest] = firstMetricValue(metricGroups).split("::");
  return { metricGroup, metric: rest.join("::"), operator: "gt", value: 0, unit: "" };
};

const GATES_EXPLAINER =
  "Gates are minimum thresholds a rep must hit before earning any payout. E.g. \"Must achieve 70% collection target\".";

export function GateRulesStep({ value, onChange, kpis, audience }: Props) {
  // Metric groups for the condition picker come from config, shared with the
  // KPI-level gate picker so both offer the exact same options.
  const metricGroups = useMetricGroups();

  const addGate = (gate?: GateRule) => {
    onChange([
      ...value,
      gate ?? {
        id: uid("gate"),
        joiner: "AND",
        conditions: [blankCondition(metricGroups)],
        consequence: { kind: "zero-all" },
      },
    ]);
  };
  const updateGate = (id: string, patch: Partial<GateRule>) => {
    onChange(value.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };
  const removeGate = (id: string) => onChange(value.filter((g) => g.id !== id));
  const [consequenceOptions, setConsequenceOptions] = useState<ConsequenceOptions>([]);
  useEffect(() => {
    fetchConsequenceOptions()
      .then(setConsequenceOptions)
      .catch(() => setConsequenceOptions([]));
  }, []);

  const TEMPLATES: Array<{ title: string; description: string; build: () => GateRule }> = [
    {
      title: "Minimum Collection",
      description: "Rep earns nothing if collection % falls below 70% of billing",
      build: () => ({
        id: uid("gate"),
        joiner: "AND",
        conditions: [{ metricGroup: "collection", metric: "COLLECTION_PCT", operator: "lt", value: 70, unit: "%" }],
        consequence: { kind: "zero-all" },
      }),
    },
    {
      title: "Attendance Gate",
      description: "Rep earns nothing if absent days exceed 5 in the period",
      build: () => ({
        id: uid("gate"),
        joiner: "AND",
        conditions: [{ metricGroup: "attendance", metric: "ABSENT_DAYS", operator: "gt", value: 5, unit: "days" }],
        consequence: { kind: "zero-all" },
      }),
    },
  ];

  return (
    <TooltipProvider>
    <div className="animate-fade-in space-y-4 max-w-4xl">
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xl font-semibold">Gate rules</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="What are gates?" className="text-muted-foreground hover:text-foreground">
                <Info size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs">
              {GATES_EXPLAINER}
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-sm text-muted-foreground">What conditions must a rep meet before earning?</p>
        <p className="text-xs text-muted-foreground mt-1">Gates zero out or reduce payouts when conditions aren't met.</p>
        {audience && <AudienceContextChip audience={audience} />}
      </div>

      {value.length === 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Start with a template</h3>
              <p className="text-xs text-muted-foreground">Pick a common gate to pre-fill, or build a custom one below.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TEMPLATES.map((t) => (
              <Card key={t.title} className="p-4 flex flex-col gap-2 border hover:border-primary/40 hover:shadow-sm transition">
                <div className="text-sm font-semibold text-foreground">{t.title}</div>
                <p className="text-xs text-muted-foreground leading-snug flex-1">{t.description}</p>
                <WizardAddButton
                  variant="outline"
                  className="self-start mt-1"
                  onClick={() => addGate(t.build())}
                >
                  Use this
                </WizardAddButton>
              </Card>
            ))}
          </div>
        </div>
      )}

      {value.map((gate) => (
        <GateCard key={gate.id} gate={gate} kpis={kpis} metricGroups={metricGroups} consequenceOptions={consequenceOptions} onUpdate={(p) => updateGate(gate.id, p)} onRemove={() => removeGate(gate.id)} />
      ))}

      <WizardAddButton onClick={() => addGate()}>
        Add gate rule
      </WizardAddButton>
    </div>
    </TooltipProvider>
  );
}

function GateCard({
  gate, kpis, metricGroups, consequenceOptions, onUpdate, onRemove,
}: { gate: GateRule; kpis: KpiItem[]; metricGroups: MetricGroups; consequenceOptions: ConsequenceOptions; onUpdate: (p: Partial<GateRule>) => void; onRemove: () => void }) {
  const updateCondition = (i: number, patch: Partial<GateCondition>) => {
    const next = [...gate.conditions];
    next[i] = { ...next[i], ...patch };
    onUpdate({ conditions: next });
  };
  const removeCondition = (i: number) => onUpdate({ conditions: gate.conditions.filter((_, j) => j !== i) });
  const addCondition = () =>
    onUpdate({
      conditions: [...gate.conditions, blankCondition(metricGroups)],
    });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Condition</Label>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {gate.conditions.map((c, i) => {
          const isFieldActivity = c.metricGroup === "field_activity";
          const supportsTerritory = isFieldActivity && TERRITORY_SPLIT_METRICS.has(c.metric);
          return (
          <div key={i} className="space-y-1">
            {i > 0 && (
              <Select value={gate.joiner} onValueChange={(v) => onUpdate({ joiner: v as "AND" | "OR" })}>
                <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND</SelectItem>
                  <SelectItem value="OR">OR</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={`${c.metricGroup}::${c.metric}`}
                onValueChange={(v) => {
                  const [group, ...rest] = v.split("::");
                  const metric = rest.join("::");
                  const patch: Partial<GateCondition> = { metricGroup: group, metric };
                  // Field-activity (HHD) metrics: seed a sensible unit and set/clear
                  // the territory filter based on whether the metric supports a split.
                  if (group === "field_activity") {
                    patch.unit = FIELD_ACTIVITY_DEFAULTS[metric] ?? c.unit;
                    patch.territoryFilter = TERRITORY_SPLIT_METRICS.has(metric) ? "all" : undefined;
                  } else {
                    patch.territoryFilter = undefined;
                  }
                  updateCondition(i, patch);
                }}
              >
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <GateMetricOptions
                    metricGroups={metricGroups}
                    kpis={kpis.map((k) => ({ id: k.id, label: k.displayName }))}
                  />
                </SelectContent>
              </Select>

              <Select value={c.operator} onValueChange={(v) => updateCondition(i, { operator: v as GateOperator })}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <NumberInput value={c.value} onValueChange={(value) => updateCondition(i, { value })} className="h-8 w-20 text-xs" />
              {c.operator === "between" && (
                <>
                  <span className="text-xs">and</span>
                  <NumberInput value={c.value2 ?? 0} onValueChange={(value2) => updateCondition(i, { value2 })} className="h-8 w-20 text-xs" />
                </>
              )}

              <Select value={c.unit || "_none"} onValueChange={(v) => updateCondition(i, { unit: v === "_none" ? "" : v })}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue placeholder="Unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  <SelectItem value="%">%</SelectItem>
                  <SelectItem value="₹">₹</SelectItem>
                  <SelectItem value="days">days</SelectItem>
                  <SelectItem value="hours">hours</SelectItem>
                  <SelectItem value="count">count</SelectItem>
                </SelectContent>
              </Select>

              {gate.conditions.length > 1 && (
                <button onClick={() => removeCondition(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {supportsTerritory && (
              <div className="pl-1 pt-1 flex items-center gap-2 flex-wrap">
                <Label className="text-[11px] text-muted-foreground">Territory type filter</Label>
                <Select
                  value={c.territoryFilter ?? "all"}
                  onValueChange={(v) => updateCondition(i, { territoryFilter: v as TerritoryFilter })}
                >
                  <SelectTrigger className="h-7 w-52 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TERRITORY_LABEL) as TerritoryFilter[]).map((t) => (
                      <SelectItem key={t} value={t}>{TERRITORY_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">Evaluates the metric only on matching working days (useful for Hybrid MRs).</span>
              </div>
            )}

            {isFieldActivity && (
              <div className="pl-1 text-[11px] text-muted-foreground">
                Source: HHD / BI Portal · Visit Time Outlet-wise report
              </div>
            )}
          </div>
          );
        })}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addCondition}>
          <Plus size={12} /> Add condition (AND / OR)
        </Button>
      </div>

      <div className="border-t pt-3 space-y-2">
        <Label className="text-xs uppercase text-muted-foreground font-semibold">Consequence</Label>
        <RadioGroup
          value={gate.consequence.kind}
          onValueChange={(v) => onUpdate({ consequence: defaultConsequence(v as ConsequenceOption["kind"], gate.consequence) })}
          className="space-y-1.5"
        >
          {consequenceOptions.map((opt) => (
            <div key={opt.kind} className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value={opt.kind} />
                {opt.kind === "reduce"
                  ? renderReduceLabel(opt.label, gate, onUpdate, kpis)
                  : opt.label}
              </label>

              {opt.kind === "zero-kpis" && gate.consequence.kind === "zero-kpis" && (
                <div className="pl-6 flex flex-wrap gap-1.5">
                  {kpis.map((k) => {
                    const ids = gate.consequence.kind === "zero-kpis" ? gate.consequence.kpiIds : [];
                    const active = ids.includes(k.id);
                    return (
                      <button
                        key={k.id}
                        onClick={() => onUpdate({
                          consequence: {
                            kind: "zero-kpis",
                            kpiIds: active ? ids.filter((x) => x !== k.id) : [...ids, k.id],
                          },
                        })}
                        className={`text-xs px-2 py-1 rounded-md border ${active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                      >
                        {k.displayName}
                      </button>
                    );
                  })}
                </div>
              )}

              {opt.kind === "custom" && gate.consequence.kind === "custom" && (
                <Input
                  value={gate.consequence.text}
                  onChange={(e) => onUpdate({ consequence: { kind: "custom", text: e.target.value } })}
                  placeholder="Describe the consequence…"
                  className="h-8 text-xs ml-6"
                />
              )}
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Plain English summary */}
      <div className="bg-muted/50 rounded-md p-2.5 text-xs">
        <span className="font-medium">If </span>
        {gate.conditions.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="text-muted-foreground"> {gate.joiner} </span>}
            {metricLabel(c, kpis, metricGroups)}{c.territoryFilter ? TERRITORY_SHORT[c.territoryFilter] : ""} {opLabel(c.operator)} {c.value}{c.operator === "between" ? `–${c.value2 ?? 0}` : ""} {c.unit}
          </span>
        ))}
        , {consequenceText(gate.consequence, kpis)}.
      </div>
    </Card>
  );
}

// Build a default consequence object for a freshly-selected kind, preserving
// the previous values where the kind is unchanged.
function defaultConsequence(kind: ConsequenceOption["kind"], prev: GateConsequence): GateConsequence {
  switch (kind) {
    case "zero-all": return { kind: "zero-all" };
    case "zero-kpis": return { kind: "zero-kpis", kpiIds: prev.kind === "zero-kpis" ? prev.kpiIds : [] };
    case "reduce": return {
      kind: "reduce",
      percent: prev.kind === "reduce" ? prev.percent : 50,
      scope: prev.kind === "reduce" ? prev.scope : "all",
    };
    case "custom": return { kind: "custom", text: prev.kind === "custom" ? prev.text : "" };
  }
}

// Render the "reduce" option label, splicing the percent input and scope select
// into the config-driven label at its {percent} / {scope} tokens.
function renderReduceLabel(
  label: string,
  gate: GateRule,
  onUpdate: (p: Partial<GateRule>) => void,
  kpis: KpiItem[]
) {
  const isReduce = gate.consequence.kind === "reduce";
  const percent = gate.consequence.kind === "reduce" ? gate.consequence.percent : 50;
  const scope = gate.consequence.kind === "reduce" ? gate.consequence.scope : "all";

  return label.split(/(\{percent\}|\{scope\})/).map((part, i) => {
    if (part === "{percent}") {
      return (
        <NumberInput
          key={i}
          disabled={!isReduce}
          value={percent}
          min={0}
          max={100}
          onValueChange={(pct) => onUpdate({ consequence: { kind: "reduce", percent: pct, scope } })}
          className="h-7 w-16 text-xs inline-block"
        />
      );
    }
    if (part === "{scope}") {
      return (
        <Select
          key={i}
          disabled={!isReduce}
          value={scope}
          onValueChange={(v) => onUpdate({ consequence: { kind: "reduce", percent, scope: v } })}
        >
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all KPIs</SelectItem>
            {kpis.map((k) => <SelectItem key={k.id} value={k.id}>{k.displayName}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

// Human label for a condition's metric: KPI display name (kpi), or the metric's
// config `name` looked up by its gate code (metric group).
function metricLabel(c: GateCondition, kpis: KpiItem[], metricGroups: MetricGroups) {
  if (c.metricGroup === "kpi") return kpis.find((k) => k.id === c.metric)?.displayName || "(KPI)";
  // NSV is no longer selectable, but gates saved before its removal still carry
  // it — label those properly rather than showing the raw "NSV" code.
  if (`${c.metricGroup}::${c.metric}` === NSV_METRIC_VALUE) return nsvMetricLabel();
  return metricGroups[c.metricGroup]?.find((m) => m.gateCode === c.metric)?.name ?? c.metric;
}

function consequenceText(c: GateConsequence, kpis: KpiItem[]) {
  switch (c.kind) {
    case "zero-all": return "rep earns ₹0 for all KPIs in this programme";
    case "zero-kpis": return `rep earns ₹0 for ${c.kpiIds.map((id) => kpis.find((k) => k.id === id)?.displayName).filter(Boolean).join(", ") || "(no KPIs selected)"}`;
    case "reduce": return `rep earns only ${c.percent}% of payout for ${c.scope === "all" ? "all KPIs" : kpis.find((k) => k.id === c.scope)?.displayName || c.scope}`;
    case "custom": return c.text || "(custom consequence)";
  }
}
