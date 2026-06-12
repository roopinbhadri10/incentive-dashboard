import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, GripVertical, Database, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type KpiItem, type SlabType, type KpiCategory,
  defaultKpi, maxPayout, payoutAt, KPI_LIBRARY, CATEGORY_LABELS,
} from "../builderState";

interface Props {
  value: KpiItem[];
  onChange: (v: KpiItem[]) => void;
}

const SLAB_LABELS: Record<SlabType, string> = {
  linear: "Linear step rate",
  tiered: "Tiered (threshold jumps)",
  "per-unit": "Per-unit rate",
  flat: "Flat trigger",
  "percent-base": "Percentage of base",
  formula: "Custom formula",
};

const dataSourceLabel = (k: KpiItem["dataSource"]) =>
  k.kind === "auto" ? "Auto" : k.kind === "upload" ? "Upload" : k.kind === "manual" ? "Manual" : "Derived";

export function KpiBuilderStep({ value, onChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(value[0]?.id ?? null);
  const [libOpen, setLibOpen] = useState(false);

  const active = value.find((k) => k.id === activeId) ?? null;

  const addKpi = (partial?: Partial<KpiItem>) => {
    const k = defaultKpi(partial);
    onChange([...value, k]);
    setActiveId(k.id);
    setLibOpen(false);
  };
  const updateKpi = (id: string, patch: Partial<KpiItem>) => {
    onChange(value.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  };
  const removeKpi = (id: string) => {
    onChange(value.filter((k) => k.id !== id));
    if (activeId === id) setActiveId(value[0]?.id ?? null);
  };
  const reorder = (id: string, dir: -1 | 1) => {
    const idx = value.findIndex((k) => k.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= value.length) return;
    const next = [...value];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const total = value.reduce((s, k) => s + maxPayout(k), 0);

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-xl font-semibold">KPI builder</h2>
        <p className="text-sm text-muted-foreground">Add KPIs and configure how reps earn for each.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* LEFT */}
        <div className="space-y-3">
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Your KPIs</span>
              <Sheet open={libOpen} onOpenChange={setLibOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" className="h-7 text-xs gap-1"><Plus size={12} />Add KPI</Button>
                </SheetTrigger>
                <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
                  <SheetHeader><SheetTitle>KPI library</SheetTitle></SheetHeader>
                  <Tabs defaultValue="sales-volume" className="mt-4">
                    <TabsList className="flex flex-wrap h-auto gap-1">
                      {(Object.keys(KPI_LIBRARY) as KpiCategory[]).map((c) => (
                        <TabsTrigger key={c} value={c} className="text-xs">{CATEGORY_LABELS[c]}</TabsTrigger>
                      ))}
                    </TabsList>
                    {(Object.keys(KPI_LIBRARY) as KpiCategory[]).map((c) => (
                      <TabsContent key={c} value={c} className="space-y-2 mt-3">
                        {KPI_LIBRARY[c].map((tpl) => (
                          <button
                            key={tpl.name}
                            onClick={() => addKpi({ internalName: tpl.name, displayName: tpl.name, description: tpl.description, category: c })}
                            className="w-full text-left p-3 rounded-md border hover:bg-muted transition"
                          >
                            <div className="text-sm font-medium">{tpl.name}</div>
                            <div className="text-xs text-muted-foreground">{tpl.description}</div>
                          </button>
                        ))}
                        <button
                          onClick={() => addKpi({ category: "custom", internalName: "Custom KPI", displayName: "Custom KPI" })}
                          className="w-full text-left p-3 rounded-md border-2 border-dashed hover:bg-muted transition flex items-center gap-2"
                        >
                          <Wand2 size={14} className="text-primary" />
                          <span className="text-sm font-medium">Custom KPI</span>
                        </button>
                      </TabsContent>
                    ))}
                  </Tabs>
                </SheetContent>
              </Sheet>
            </div>

            {value.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
                No KPIs yet — add your first KPI to get started
              </div>
            ) : (
              <div className="space-y-1.5">
                {value.map((k) => (
                  <div
                    key={k.id}
                    onClick={() => setActiveId(k.id)}
                    className={cn(
                      "flex items-start gap-1.5 p-2 rounded-md border cursor-pointer transition",
                      activeId === k.id ? "border-primary bg-sidebar-accent" : "hover:bg-muted",
                    )}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); reorder(k.id, -1); }}
                      className="text-muted-foreground hover:text-foreground mt-0.5"
                      title="Move up"
                    >
                      <GripVertical size={12} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{k.displayName}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{CATEGORY_LABELS[k.category]}</Badge>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">₹{maxPayout(k).toLocaleString()}</Badge>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                          <Database size={8} />{dataSourceLabel(k.dataSource)}
                        </Badge>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeKpi(k.id); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t mt-3 pt-2 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Total max payout</span>
              <span className="font-semibold">₹{total.toLocaleString()}</span>
            </div>
          </Card>
        </div>

        {/* RIGHT — Editor */}
        <div>
          {active ? (
            <KpiEditor kpi={active} onUpdate={(p) => updateKpi(active.id, p)} otherKpis={value.filter(k => k.id !== active.id)} />
          ) : (
            <Card className="p-12 text-center text-sm text-muted-foreground border-dashed">
              Add a KPI to start configuring.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Editor ─────────────────────────────────────────────────────────────────
function KpiEditor({ kpi, onUpdate, otherKpis }: { kpi: KpiItem; onUpdate: (p: Partial<KpiItem>) => void; otherKpis: KpiItem[]; }) {
  return (
    <Card className="p-5 space-y-5">
      <Section title="1. Name & label">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Internal name (admin)">
            <Input value={kpi.internalName} onChange={(e) => onUpdate({ internalName: e.target.value })} className="h-9" />
          </Field>
          <Field label="Display name (rep-facing)">
            <Input value={kpi.displayName} onChange={(e) => onUpdate({ displayName: e.target.value })} className="h-9" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={kpi.description} onChange={(e) => onUpdate({ description: e.target.value })} rows={2} />
        </Field>
      </Section>

      <Section title="2. Data source">
        <RadioGroup
          value={kpi.dataSource.kind}
          onValueChange={(v) => {
            if (v === "derived") onUpdate({ dataSource: { kind: "derived", multiplier: 1 } });
            else onUpdate({ dataSource: { kind: v as "auto" | "upload" | "manual" } });
          }}
          className="space-y-1.5"
        >
          <Radio v="auto" label="Auto-calculated from sales data" />
          <Radio v="upload" label="File upload — admin uploads each period" />
          <Radio v="manual" label="Manual entry by manager" />
          <Radio v="derived" label="Derived from another KPI" />
        </RadioGroup>
        {kpi.dataSource.kind === "derived" && (
          <div className="flex items-center gap-2 pl-6 pt-2">
            <Select
              value={kpi.dataSource.fromKpiId || ""}
              onValueChange={(v) => onUpdate({ dataSource: { ...kpi.dataSource, kind: "derived", fromKpiId: v, multiplier: kpi.dataSource.kind === "derived" ? kpi.dataSource.multiplier : 1 } })}
            >
              <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Select KPI" /></SelectTrigger>
              <SelectContent>
                {otherKpis.map((k) => <SelectItem key={k.id} value={k.id}>{k.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs">×</span>
            <Input
              type="number"
              value={kpi.dataSource.kind === "derived" ? kpi.dataSource.multiplier : 1}
              onChange={(e) => onUpdate({ dataSource: { kind: "derived", fromKpiId: kpi.dataSource.kind === "derived" ? kpi.dataSource.fromKpiId : undefined, multiplier: Number(e.target.value) } })}
              className="h-8 w-20 text-xs"
            />
          </div>
        )}
      </Section>

      <Section title="3. Target source">
        <RadioGroup
          value={kpi.targetSource.kind}
          onValueChange={(v) => {
            if (v === "fixed") onUpdate({ targetSource: { kind: "fixed", value: 100000 } });
            else onUpdate({ targetSource: { kind: v as "system" | "upload" | "manual" } });
          }}
          className="space-y-1.5"
        >
          <Radio v="system" label="System-generated (AI/ML)" />
          <Radio v="upload" label="Uploaded by admin (file upload per period)" />
          <Radio v="manual" label="Set manually per rep" />
          <Radio v="fixed" label="Fixed value for all reps" />
        </RadioGroup>
        {kpi.targetSource.kind === "fixed" && (
          <div className="pl-6 pt-2">
            <Input
              type="number"
              value={kpi.targetSource.value}
              onChange={(e) => onUpdate({ targetSource: { kind: "fixed", value: Number(e.target.value) } })}
              className="h-8 w-40 text-xs"
            />
          </div>
        )}
      </Section>

      <Section title="4. Slab type">
        <RadioGroup
          value={kpi.slabType}
          onValueChange={(v) => onUpdate({ slabType: v as SlabType })}
          className="grid grid-cols-2 gap-1.5"
        >
          {(Object.keys(SLAB_LABELS) as SlabType[]).map((t) => (
            <Radio key={t} v={t} label={SLAB_LABELS[t]} />
          ))}
        </RadioGroup>

        <div className="border-t pt-3 mt-3">
          <SlabConfig kpi={kpi} onUpdate={onUpdate} />
        </div>
      </Section>

      <Section title="5. Live payout preview">
        <PreviewTable kpi={kpi} />
      </Section>
    </Card>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{title}</div>
    <div className="space-y-2">{children}</div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

const Radio = ({ v, label }: { v: string; label: string }) => (
  <label className="flex items-center gap-2 text-sm cursor-pointer">
    <RadioGroupItem value={v} /> {label}
  </label>
);

function SlabConfig({ kpi, onUpdate }: { kpi: KpiItem; onUpdate: (p: Partial<KpiItem>) => void }) {
  switch (kpi.slabType) {
    case "linear":
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Entry %">
            <Input type="number" value={kpi.linear.entryPct} onChange={(e) => onUpdate({ linear: { ...kpi.linear, entryPct: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
          <Field label="Entry payout ₹">
            <Input type="number" value={kpi.linear.entryPayout} onChange={(e) => onUpdate({ linear: { ...kpi.linear, entryPayout: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
          <Field label="Step ₹/1%">
            <Input type="number" value={kpi.linear.stepRate} onChange={(e) => onUpdate({ linear: { ...kpi.linear, stepRate: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
          <Field label="Cap ₹">
            <Input type="number" value={kpi.linear.cap} onChange={(e) => onUpdate({ linear: { ...kpi.linear, cap: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
        </div>
      );
    case "tiered":
      return (
        <div className="space-y-2">
          {kpi.tiered.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="number" value={r.pct} onChange={(e) => {
                const rows = [...kpi.tiered.rows]; rows[i] = { ...r, pct: Number(e.target.value) };
                onUpdate({ tiered: { rows } });
              }} className="h-8 w-24 text-xs" placeholder="%" />
              <span className="text-xs">→</span>
              <Input type="number" value={r.payout} onChange={(e) => {
                const rows = [...kpi.tiered.rows]; rows[i] = { ...r, payout: Number(e.target.value) };
                onUpdate({ tiered: { rows } });
              }} className="h-8 w-32 text-xs" placeholder="₹" />
              {kpi.tiered.rows.length > 2 && (
                <button onClick={() => onUpdate({ tiered: { rows: kpi.tiered.rows.filter((_, j) => j !== i) } })} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {kpi.tiered.rows.length < 8 && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onUpdate({ tiered: { rows: [...kpi.tiered.rows, { pct: 100, payout: 0 }] } })}>
              <Plus size={10} />Add tier
            </Button>
          )}
        </div>
      );
    case "per-unit":
      return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Field label="Unit label">
            <Input value={kpi.perUnit.unitLabel} onChange={(e) => onUpdate({ perUnit: { ...kpi.perUnit, unitLabel: e.target.value } })} className="h-8 text-xs" />
          </Field>
          <Field label="Min count">
            <Input type="number" value={kpi.perUnit.minCount} onChange={(e) => onUpdate({ perUnit: { ...kpi.perUnit, minCount: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
          <Field label="Max count">
            <Input type="number" value={kpi.perUnit.maxCount} onChange={(e) => onUpdate({ perUnit: { ...kpi.perUnit, maxCount: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
          <Field label="Rate ₹/unit">
            <Input type="number" value={kpi.perUnit.ratePerUnit} onChange={(e) => onUpdate({ perUnit: { ...kpi.perUnit, ratePerUnit: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
          <Field label="Cap ₹">
            <Input type="number" value={kpi.perUnit.cap} onChange={(e) => onUpdate({ perUnit: { ...kpi.perUnit, cap: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
        </div>
      );
    case "flat":
      return (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Threshold">
            <Input type="number" value={kpi.flat.threshold} onChange={(e) => onUpdate({ flat: { ...kpi.flat, threshold: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
          <Field label="Threshold type">
            <Select value={kpi.flat.thresholdType} onValueChange={(v) => onUpdate({ flat: { ...kpi.flat, thresholdType: v as "percent" | "count" | "amount" } })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">% achievement</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="amount">₹ amount</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Flat payout ₹">
            <Input type="number" value={kpi.flat.payout} onChange={(e) => onUpdate({ flat: { ...kpi.flat, payout: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
        </div>
      );
    case "percent-base":
      return (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Base">
            <Select value={kpi.percentBase.base} onValueChange={(v) => onUpdate({ percentBase: { ...kpi.percentBase, base: v as "salary" | "fixed" | "custom" } })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="salary">Salary</SelectItem>
                <SelectItem value="fixed">Fixed component</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {kpi.percentBase.base === "custom" && (
            <Field label="Custom label">
              <Input value={kpi.percentBase.customLabel || ""} onChange={(e) => onUpdate({ percentBase: { ...kpi.percentBase, customLabel: e.target.value } })} className="h-8 text-xs" />
            </Field>
          )}
          <Field label="Percentage %">
            <Input type="number" value={kpi.percentBase.percent} onChange={(e) => onUpdate({ percentBase: { ...kpi.percentBase, percent: Number(e.target.value) } })} className="h-8 text-xs" />
          </Field>
        </div>
      );
    case "formula":
      return (
        <div className="space-y-2">
          <Input value={kpi.formula.formula} onChange={(e) => onUpdate({ formula: { formula: e.target.value } })} placeholder="(Achievement × Rate) + Bonus if > Target" className="text-xs" />
          <p className="text-[11px] text-muted-foreground">Formula is descriptive — actual calculation set in integration.</p>
        </div>
      );
  }
}

function PreviewTable({ kpi }: { kpi: KpiItem }) {
  let rows: Array<{ label: string; payout: number; note?: string }> = [];
  switch (kpi.slabType) {
    case "linear":
      rows = [
        { label: `< ${kpi.linear.entryPct}%`, payout: 0, note: "Below entry" },
        { label: `${kpi.linear.entryPct}%`, payout: payoutAt(kpi, kpi.linear.entryPct), note: "Entry" },
        { label: `${kpi.linear.entryPct + 5}%`, payout: payoutAt(kpi, kpi.linear.entryPct + 5) },
        { label: `${kpi.linear.entryPct + 10}%`, payout: payoutAt(kpi, kpi.linear.entryPct + 10) },
        { label: `100%+`, payout: kpi.linear.cap, note: "Capped" },
      ];
      break;
    case "tiered":
      rows = [...kpi.tiered.rows].sort((a, b) => a.pct - b.pct).map((r) => ({ label: `${r.pct}%`, payout: r.payout }));
      break;
    case "per-unit":
      rows = [
        { label: `${kpi.perUnit.minCount} ${kpi.perUnit.unitLabel}`, payout: kpi.perUnit.minCount * kpi.perUnit.ratePerUnit, note: "Min" },
        { label: `${Math.round((kpi.perUnit.minCount + kpi.perUnit.maxCount) / 2)} ${kpi.perUnit.unitLabel}`, payout: Math.min(Math.round((kpi.perUnit.minCount + kpi.perUnit.maxCount) / 2) * kpi.perUnit.ratePerUnit, kpi.perUnit.cap) },
        { label: `${kpi.perUnit.maxCount} ${kpi.perUnit.unitLabel}`, payout: Math.min(kpi.perUnit.maxCount * kpi.perUnit.ratePerUnit, kpi.perUnit.cap), note: "Max" },
      ];
      break;
    case "flat":
      rows = [
        { label: `Below ${kpi.flat.threshold}`, payout: 0 },
        { label: `≥ ${kpi.flat.threshold}`, payout: kpi.flat.payout, note: "Trigger met" },
      ];
      break;
    case "percent-base":
      rows = [{ label: `${kpi.percentBase.percent}% of ${kpi.percentBase.base}`, payout: Math.round((kpi.percentBase.percent / 100) * 30000), note: "Assumed base ₹30,000" }];
      break;
    case "formula":
      rows = [{ label: kpi.formula.formula, payout: 0, note: "Computed at integration" }];
      break;
  }
  return (
    <table className="w-full text-xs border rounded-md overflow-hidden">
      <thead className="bg-muted">
        <tr>
          <th className="text-left px-3 py-1.5 font-medium">Achievement level</th>
          <th className="text-left px-3 py-1.5 font-medium">Payout</th>
          <th className="text-left px-3 py-1.5 font-medium">Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t">
            <td className="px-3 py-1.5">{r.label}</td>
            <td className="px-3 py-1.5 font-medium">₹{r.payout.toLocaleString()}</td>
            <td className="px-3 py-1.5 text-muted-foreground">{r.note || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
