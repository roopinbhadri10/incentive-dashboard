import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import type { GateRule, GateCondition, GateConsequence, KpiItem, GateOperator, AudienceV2State } from "../builderState";
import { uid } from "../builderState";
import { AudienceContextChip } from "../AudienceContextChip";

interface Props {
  value: GateRule[];
  onChange: (v: GateRule[]) => void;
  kpis: KpiItem[];
  audience?: AudienceV2State;
}

const METRIC_GROUPS = {
  attendance: [
    "Attendance %",
    "Absent days",
    "Present days",
    "Working days",
    "Consecutive absent days",
    "Leave without approval",
  ],
  collection: [
    "Collection % of billing",
    "Overdue amount (₹)",
    "Overdue > 30 days %",
    "Overdue > 60 days %",
    "Overdue > 90 days %",
    "Avg. credit days",
    "Cheque bounce count",
  ],
  productivity: [
    "Visits per day (PCC)",
    "Beat plan adherence %",
    "Productive call %",
    "Visit strike rate %",
    "App login days",
    "Calls made",
    "Orders booked per day",
    "Drop size (₹/order)",
  ],
  compliance: [
    "GPS / geo-tag compliance %",
    "DAR / daily report submission %",
    "Order punching SLA %",
    "Photo capture compliance %",
    "Planogram compliance %",
    "Training module completion %",
    "Selfie / attendance photo compliance %",
  ],
  distribution: [
    "ECO — Effective coverage outlets",
    "New outlets added",
    "Outlet retention %",
    "ULPO — Unique lines per outlet",
    "Range selling %",
    "Must-sell SKU strike rate %",
    "Focus SKU / NPD billing",
  ],
  sales_hygiene: [
    "Sales return %",
    "Damaged / expired stock %",
    "Scheme / claim accuracy %",
    "Primary vs secondary variance %",
    "Stock-out days",
  ],
};

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
        conditions: [{ metricGroup: "attendance", metric: "Absent days", operator: "gt", value: 5, unit: "days" }],
        consequence: { kind: "zero-all" },
      },
    ]);
  };
  const updateGate = (id: string, patch: Partial<GateRule>) => {
    onChange(value.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };
  const removeGate = (id: string) => onChange(value.filter((g) => g.id !== id));

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
        <GateCard key={gate.id} gate={gate} kpis={kpis} onUpdate={(p) => updateGate(gate.id, p)} onRemove={() => removeGate(gate.id)} />
      ))}

      <Button variant="outline" onClick={addGate} className="gap-1">
        <Plus size={14} /> Add gate rule
      </Button>
    </div>
  );
}

function GateCard({
  gate, kpis, onUpdate, onRemove,
}: { gate: GateRule; kpis: KpiItem[]; onUpdate: (p: Partial<GateRule>) => void; onRemove: () => void }) {
  const updateCondition = (i: number, patch: Partial<GateCondition>) => {
    const next = [...gate.conditions];
    next[i] = { ...next[i], ...patch };
    onUpdate({ conditions: next });
  };
  const removeCondition = (i: number) => onUpdate({ conditions: gate.conditions.filter((_, j) => j !== i) });
  const addCondition = () =>
    onUpdate({
      conditions: [...gate.conditions, { metricGroup: "attendance", metric: "Absent days", operator: "gt", value: 0, unit: "" }],
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
                  updateCondition(i, { metricGroup: group as GateCondition["metricGroup"], metric: rest.join("::") });
                }}
              >
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {kpis.length > 0 && (
                    <>
                      <div className="text-[10px] uppercase text-muted-foreground px-2 py-1">From your KPIs</div>
                      {kpis.map((k) => <SelectItem key={k.id} value={`kpi::${k.id}`}>{k.displayName}</SelectItem>)}
                    </>
                  )}
                  {Object.entries(METRIC_GROUPS).map(([group, items]) => (
                    <div key={group}>
                      <div className="text-[10px] uppercase text-muted-foreground px-2 py-1">{group}</div>
                      {items.map((m) => <SelectItem key={`${group}-${m}`} value={`${group}::${m}`}>{m}</SelectItem>)}
                    </div>
                  ))}
                  <div className="text-[10px] uppercase text-muted-foreground px-2 py-1">Custom</div>
                  <SelectItem value="custom::Custom metric">Custom metric…</SelectItem>
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
          onValueChange={(v) => {
            if (v === "zero-all") onUpdate({ consequence: { kind: "zero-all" } });
            else if (v === "zero-kpis") onUpdate({ consequence: { kind: "zero-kpis", kpiIds: [] } });
            else if (v === "reduce") onUpdate({ consequence: { kind: "reduce", percent: 50, scope: "all" } });
            else onUpdate({ consequence: { kind: "custom", text: "" } });
          }}
          className="space-y-1.5"
        >
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="zero-all" /> Rep earns ₹0 for this entire programme
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="zero-kpis" /> Rep earns ₹0 for specific KPIs
          </label>
          {gate.consequence.kind === "zero-kpis" && (
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
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="reduce" /> Rep earns only
            <Input
              type="number"
              disabled={gate.consequence.kind !== "reduce"}
              value={gate.consequence.kind === "reduce" ? gate.consequence.percent : 50}
              onChange={(e) => onUpdate({ consequence: { kind: "reduce", percent: Number(e.target.value), scope: gate.consequence.kind === "reduce" ? gate.consequence.scope : "all" } })}
              className="h-7 w-16 text-xs inline-block"
            />
            % of payout for
            <Select
              disabled={gate.consequence.kind !== "reduce"}
              value={gate.consequence.kind === "reduce" ? gate.consequence.scope : "all"}
              onValueChange={(v) => onUpdate({ consequence: { kind: "reduce", percent: gate.consequence.kind === "reduce" ? gate.consequence.percent : 50, scope: v } })}
            >
              <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all KPIs</SelectItem>
                {kpis.map((k) => <SelectItem key={k.id} value={k.id}>{k.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="custom" /> Custom description
          </label>
          {gate.consequence.kind === "custom" && (
            <Input
              value={gate.consequence.text}
              onChange={(e) => onUpdate({ consequence: { kind: "custom", text: e.target.value } })}
              placeholder="Describe the consequence…"
              className="h-8 text-xs ml-6"
            />
          )}
        </RadioGroup>
      </div>

      {/* Plain English summary */}
      <div className="bg-muted/50 rounded-md p-2.5 text-xs">
        <span className="font-medium">If </span>
        {gate.conditions.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="text-muted-foreground"> {gate.joiner} </span>}
            {kpiName(c, kpis)} {opLabel(c.operator)} {c.value}{c.operator === "between" ? `–${c.value2 ?? 0}` : ""} {c.unit}
          </span>
        ))}
        , {consequenceText(gate.consequence, kpis)}.
      </div>
    </Card>
  );
}

function kpiName(c: GateCondition, kpis: KpiItem[]) {
  if (c.metricGroup === "kpi") return kpis.find((k) => k.id === c.metric)?.displayName || "(KPI)";
  return c.metric;
}

function consequenceText(c: GateConsequence, kpis: KpiItem[]) {
  switch (c.kind) {
    case "zero-all": return "rep earns ₹0 for all KPIs in this programme";
    case "zero-kpis": return `rep earns ₹0 for ${c.kpiIds.map((id) => kpis.find((k) => k.id === id)?.displayName).filter(Boolean).join(", ") || "(no KPIs selected)"}`;
    case "reduce": return `rep earns only ${c.percent}% of payout for ${c.scope === "all" ? "all KPIs" : kpis.find((k) => k.id === c.scope)?.displayName || c.scope}`;
    case "custom": return c.text || "(custom consequence)";
  }
}
