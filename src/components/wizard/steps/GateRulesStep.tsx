import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { GateRule, GateCondition, GateConsequence, KpiItem, GateOperator, AudienceV2State } from "../builderState";
import { uid } from "../builderState";
import { AudienceContextChip } from "../AudienceContextChip";
import {
  fetchConsequenceOptions,
  type MetricGroups, type ConsequenceOptions, type ConsequenceOption,
} from "@/lib/saleshubApi";
import { GateMetricOptions, useMetricGroups } from "@/components/kpi-library/GateMetricOptions";

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

export function GateRulesStep({ value, onChange, kpis, audience }: Props) {
  const addGate = () => {
    onChange([
      ...value,
      {
        id: uid("gate"),
        joiner: "AND",
        conditions: [{ metricGroup: "attendance", metric: "ABSENT_DAYS", operator: "gt", value: 5, unit: "days" }],
        consequence: { kind: "zero-all" },
      },
    ]);
  };
  const updateGate = (id: string, patch: Partial<GateRule>) => {
    onChange(value.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };
  const removeGate = (id: string) => onChange(value.filter((g) => g.id !== id));

  // Metric groups for the condition picker come from config, shared with the
  // KPI-level gate picker so both offer the exact same options.
  const metricGroups = useMetricGroups();
  const [consequenceOptions, setConsequenceOptions] = useState<ConsequenceOptions>([]);
  useEffect(() => {
    fetchConsequenceOptions()
      .then(setConsequenceOptions)
      .catch(() => setConsequenceOptions([]));
  }, []);

  return (
    <div className="animate-fade-in space-y-4 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold">Gate rules</h2>
        <p className="text-sm text-muted-foreground">What conditions must a rep meet before earning?</p>
        <p className="text-xs text-muted-foreground mt-1">Gates zero out or reduce payouts when conditions aren't met.</p>
        {audience && <AudienceContextChip audience={audience} />}
      </div>

      {value.length === 0 && (
        <Card className="p-10 text-center border-dashed flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">No gates added — optional but powerful</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Gates are minimum thresholds a rep must hit before earning any payout. E.g. "Must achieve 70% collection target".
            </p>
          </div>
          <Button onClick={addGate} size="sm" className="gap-1 mt-1">
            <Plus size={14} /> Add your first gate
          </Button>
        </Card>
      )}

      {value.map((gate) => (
        <GateCard key={gate.id} gate={gate} kpis={kpis} metricGroups={metricGroups} consequenceOptions={consequenceOptions} onUpdate={(p) => updateGate(gate.id, p)} onRemove={() => removeGate(gate.id)} />
      ))}

      <Button variant="outline" onClick={addGate} className="gap-1">
        <Plus size={14} /> Add gate rule
      </Button>
    </div>
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
      conditions: [...gate.conditions, { metricGroup: "attendance", metric: "ABSENT_DAYS", operator: "gt", value: 0, unit: "" }],
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
        {gate.conditions.map((c, i) => (
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
                  updateCondition(i, { metricGroup: group, metric: rest.join("::") });
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

              {c.metricGroup === "custom" && (
                <Input
                  value={c.metric === "Custom metric" ? "" : c.metric}
                  placeholder="Metric name"
                  onChange={(e) => updateCondition(i, { metric: e.target.value })}
                  className="h-8 w-40 text-xs"
                />
              )}

              <Select value={c.operator} onValueChange={(v) => updateCondition(i, { operator: v as GateOperator })}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Input type="number" value={c.value} onChange={(e) => updateCondition(i, { value: Number(e.target.value) })} className="h-8 w-20 text-xs" />
              {c.operator === "between" && (
                <>
                  <span className="text-xs">and</span>
                  <Input type="number" value={c.value2 ?? 0} onChange={(e) => updateCondition(i, { value2: Number(e.target.value) })} className="h-8 w-20 text-xs" />
                </>
              )}

              <Select value={c.unit || "_none"} onValueChange={(v) => updateCondition(i, { unit: v === "_none" ? "" : v })}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue placeholder="Unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  <SelectItem value="%">%</SelectItem>
                  <SelectItem value="₹">₹</SelectItem>
                  <SelectItem value="days">days</SelectItem>
                  <SelectItem value="count">count</SelectItem>
                </SelectContent>
              </Select>

              {gate.conditions.length > 1 && (
                <button onClick={() => removeCondition(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
        <button onClick={addCondition} className="text-xs text-primary hover:underline">+ Add condition</button>
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
            {metricLabel(c, kpis, metricGroups)} {opLabel(c.operator)} {c.value}{c.operator === "between" ? `–${c.value2 ?? 0}` : ""} {c.unit}
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
        <Input
          key={i}
          type="number"
          disabled={!isReduce}
          value={percent}
          onChange={(e) => onUpdate({ consequence: { kind: "reduce", percent: Number(e.target.value), scope } })}
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

// Human label for a condition's metric: KPI display name (kpi), the metric's
// config `name` looked up by its gate code (metric group), or the free text (custom).
function metricLabel(c: GateCondition, kpis: KpiItem[], metricGroups: MetricGroups) {
  if (c.metricGroup === "kpi") return kpis.find((k) => k.id === c.metric)?.displayName || "(KPI)";
  if (c.metricGroup === "custom") return c.metric;
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
