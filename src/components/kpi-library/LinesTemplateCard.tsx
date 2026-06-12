import { useEffect } from "react";
import { Plus, Trash2, Info, Lock, Users } from "lucide-react";
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
import { DbbProductSelector, DEFAULT_DBB_PRODUCTS, type DbbProductConfig } from "./DbbProductSelector";

export type LineCountingLevel = "sku" | "group";

const DEFAULT_TLSD_KEY_NOTES = [
  "Counts unique lines sold at CRS group code level.",
  "2 SKUs in the same CRS = 1 line.",
  "Same CRS in separate visits to the same outlet = 2 lines.",
];

const DEFAULT_DBB_KEY_NOTES = [
  "Counts lines only for client-designated focus SKUs.",
  "Same CRS counting rules as TLSD.",
  "Refer to the focus SKU list for eligible products.",
];

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type RoleMode = "mr" | "aso_ase";

export type MinQtyUom = "case" | "piece" | "carton" | "kg" | "litre" | "other";

export interface LinesConfig {
  role: RoleMode;
  countingLevel: LineCountingLevel;
  minQtyEnabled: boolean;
  minQtyValue: number;
  minQtyUom: MinQtyUom;
  minQtyUomOther?: string;
  minLines: number;
  maxLines: number; // cap
  ratePerLine: number;
  rateMultiplier: number; // ASO/ASE
  focusSkuFile?: string; // DBB legacy — kept for backwards compatibility
  dbbProducts?: DbbProductConfig; // DBB only
  gatesEnabled: boolean;
  gates: GateCondition[];
  keyNotes?: string[];
}

interface Props {
  selfId: string; // "tlsd" | "dbb"
  title: string;
  tag: string;
  description: string;
  countingLevelLabel: string; // e.g. "CRS group code"
  showFocusSkuUpload?: boolean;
  defaults: Pick<LinesConfig, "minLines" | "maxLines" | "ratePerLine">;
  defaultKeyNotes?: string[];
  value?: LinesConfig;
  onChange?: (v: LinesConfig) => void;
  lockedRole?: "mr" | "aso";
  hideRoleSelector?: boolean;
}

export function defaultLinesConfig(
  d: Pick<LinesConfig, "minLines" | "maxLines" | "ratePerLine">,
  keyNotes?: string[],
  opts?: { withDbbProducts?: boolean; countingLevel?: LineCountingLevel },
): LinesConfig {
  return {
    role: "mr",
    countingLevel: opts?.countingLevel ?? "group",
    minQtyEnabled: false,
    minQtyValue: 1,
    minQtyUom: "case",
    minLines: d.minLines,
    maxLines: d.maxLines,
    ratePerLine: d.ratePerLine,
    rateMultiplier: 3,
    gatesEnabled: false,
    gates: [],
    keyNotes: keyNotes ? [...keyNotes] : undefined,
    dbbProducts: opts?.withDbbProducts ? { ...DEFAULT_DBB_PRODUCTS } : undefined,
  };
}

export function LinesTemplateCard({
  selfId,
  title,
  tag,
  description,
  countingLevelLabel,
  showFocusSkuUpload = false,
  defaults,
  defaultKeyNotes,
  value,
  onChange,
  lockedRole,
  hideRoleSelector,
}: Props) {
  const [cfg, setCfg] = useControlled<LinesConfig>(
    value,
    onChange,
    defaultLinesConfig(defaults, defaultKeyNotes, { withDbbProducts: showFocusSkuUpload }),
  );
  const lockedCfgRole: RoleMode | undefined = lockedRole === "aso" ? "aso_ase" : lockedRole === "mr" ? "mr" : undefined;
  useEffect(() => {
    if (lockedCfgRole && cfg.role !== lockedCfgRole) setCfg((c) => ({ ...c, role: lockedCfgRole }));
  }, [lockedCfgRole]);

  const minPayout = cfg.minLines * cfg.ratePerLine;
  const maxPayout = cfg.maxLines * cfg.ratePerLine;
  const invalidRange = cfg.maxLines <= cfg.minLines;

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


  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-muted/30">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <Badge variant="secondary" className="text-[10px]">{tag}</Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Lock size={10} /> Monthly payout
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              Counting: {cfg.countingLevel === "sku" ? "SKU code" : "Group code"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Rules · 2 SKUs in same CRS = 1 line · Same CRS, same outlet, separate visits = 2 lines.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {cfg.role === "mr" ? "Max earning" : "Formula"}
          </div>
          <div className="text-lg font-semibold text-primary">
            {cfg.role === "mr"
              ? fmt(maxPayout)
              : `${cfg.rateMultiplier} × Avg MR earning`}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Role */}
        {!hideRoleSelector && (
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Users size={12} /> 1 · Role this template configures
            </Label>
            <div className="flex items-center gap-3">
              {lockedCfgRole ? (
                <Badge variant="outline" className="text-xs gap-1"><Lock size={10} />
                  {cfg.role === "mr" ? "MR — rate × lines" : "ASO / ASE — Rate × Avg MR earning"}
                </Badge>
              ) : (
                <Select value={cfg.role} onValueChange={(v) => setCfg((c) => ({ ...c, role: v as RoleMode }))}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mr">MR — rate × lines</SelectItem>
                    <SelectItem value="aso_ase">ASO / ASE — Rate × Avg MR earning</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                {cfg.role === "mr"
                  ? "Earning is computed from lines sold within min/max bounds."
                  : "Earning is derived from the MRs that report to this manager."}
              </p>
            </div>
          </section>
        )}

        {/* Earning */}
        {cfg.role === "mr" ? (
          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2 · Lines-based earning (MR)
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Min lines to earn</Label>
                <Input
                  type="number"
                  value={cfg.minLines}
                  onChange={(e) => setCfg((c) => ({ ...c, minLines: Number(e.target.value) }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Max lines (cap)</Label>
                <Input
                  type="number"
                  value={cfg.maxLines}
                  onChange={(e) => setCfg((c) => ({ ...c, maxLines: Number(e.target.value) }))}
                  className={`h-9 ${invalidRange ? "border-destructive" : ""}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Rate per line (₹)</Label>
                <Input
                  type="number"
                  value={cfg.ratePerLine}
                  onChange={(e) => setCfg((c) => ({ ...c, ratePerLine: Number(e.target.value) }))}
                  className="h-9"
                />
              </div>
            </div>
            {invalidRange && (
              <p className="text-xs text-destructive">Max lines must be greater than min lines.</p>
            )}

            {/* Earning preview */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Earning potential
              </Label>
              <div className="flex items-center flex-wrap gap-2 text-sm">
                {[cfg.minLines, Math.round((cfg.minLines + cfg.maxLines) / 2), cfg.maxLines].map((n, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="inline-flex flex-col items-center px-2 py-1 rounded bg-card border border-border min-w-[72px]">
                      <span className="text-[10px] text-muted-foreground">{n} lines</span>
                      <span className="text-sm font-semibold text-foreground">{fmt(n * cfg.ratePerLine)}</span>
                    </span>
                    {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Earn <span className="font-medium text-foreground">{fmt(minPayout)}</span> at {cfg.minLines} lines,
                capped at <span className="font-medium text-foreground">{fmt(maxPayout)}</span> at {cfg.maxLines} lines.
              </p>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2 · Earning formula (ASO / ASE)
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
                The rupee value resolves at runtime from the average MR earning under this ASO/ASE.
              </p>
            </div>
          </section>
        )}

        {/* Counting level (SKU code vs Group code) */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            3 · Counting level
          </Label>
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={cfg.countingLevel}
              onValueChange={(v) => setCfg((c) => ({ ...c, countingLevel: v as LineCountingLevel }))}
            >
              <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="group">Group code (CRS) — variants roll up</SelectItem>
                <SelectItem value="sku">SKU code — each SKU counts separately</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
              {cfg.countingLevel === "group"
                ? "2 SKUs in the same CRS group = 1 line. Use this when you want broad distribution credit."
                : "Each unique SKU code counts as a separate line. Use this to push deep variant penetration."}
            </p>
          </div>
        </section>

        {/* DBB product source (DBB only) */}
        {showFocusSkuUpload && (
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              4 · Focus products
            </Label>
            <DbbProductSelector
              value={cfg.dbbProducts ?? DEFAULT_DBB_PRODUCTS}
              onChange={(v) => setCfg((c) => ({ ...c, dbbProducts: v }))}
            />
          </section>
        )}

        {/* Min qty to qualify a line */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {showFocusSkuUpload ? "5" : "4"} · Min qty to qualify a line
            </Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={cfg.minQtyEnabled}
                onCheckedChange={(v) => setCfg((c) => ({ ...c, minQtyEnabled: v }))}
              />
              <span className="text-xs text-muted-foreground">
                {cfg.minQtyEnabled ? "Enabled" : "Disabled — any qty counts"}
              </span>
            </div>
          </div>
          {cfg.minQtyEnabled && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-end gap-2 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Min qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={cfg.minQtyValue}
                    onChange={(e) => setCfg((c) => ({ ...c, minQtyValue: Number(e.target.value) }))}
                    className="h-8 w-24"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">UOM</Label>
                  <Select
                    value={cfg.minQtyUom}
                    onValueChange={(v) => setCfg((c) => ({ ...c, minQtyUom: v as MinQtyUom }))}
                  >
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="case">Case</SelectItem>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="carton">Carton</SelectItem>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="litre">Litre</SelectItem>
                      <SelectItem value="other">Other…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {cfg.minQtyUom === "other" && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Custom UOM</Label>
                    <Input
                      value={cfg.minQtyUomOther ?? ""}
                      placeholder="e.g. dozen"
                      onChange={(e) => setCfg((c) => ({ ...c, minQtyUomOther: e.target.value }))}
                      className="h-8 w-32"
                    />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Info size={12} className="mt-0.5 shrink-0" />
                A line at the {cfg.countingLevel === "sku" ? "SKU code" : "group code"} level is counted
                only when at least{" "}
                <span className="font-medium text-foreground">
                  {cfg.minQtyValue}{" "}
                  {cfg.minQtyUom === "other" ? (cfg.minQtyUomOther || "unit") : cfg.minQtyUom}
                  {cfg.minQtyValue === 1 ? "" : "s"}
                </span>{" "}
                are sold in a single invoice.
              </p>
            </div>
          )}
        </section>

        {/* Gates */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {showFocusSkuUpload ? "6" : "5"} · Gate conditions
            </Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={cfg.gatesEnabled}
                onCheckedChange={(v) => setCfg((c) => ({ ...c, gatesEnabled: v, gates: v ? c.gates : [] }))}
              />
              <span className="text-xs text-muted-foreground">{cfg.gatesEnabled ? "Enabled" : "Disabled"}</span>
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
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
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
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
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
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
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
          notes={cfg.keyNotes ?? defaultKeyNotes ?? []}
          onChange={(keyNotes) => setCfg((c) => ({ ...c, keyNotes }))}
        />
      </div>
    </Card>
  );
}

type WrapperProps = { value?: LinesConfig; onChange?: (v: LinesConfig) => void; lockedRole?: "mr" | "aso"; hideRoleSelector?: boolean };

export const TLSD_DEFAULTS = { minLines: 750, maxLines: 2500, ratePerLine: 1 };
export const DBB_DEFAULTS = { minLines: 200, maxLines: 800, ratePerLine: 3 };
export const TLSD_KEY_NOTES = DEFAULT_TLSD_KEY_NOTES;
export const DBB_KEY_NOTES = DEFAULT_DBB_KEY_NOTES;

export function TlsdTemplateCard(props: WrapperProps = {}) {
  return (
    <LinesTemplateCard
      selfId="tlsd"
      title="TLSD — Total Lines Sold"
      tag="Distribution"
      description="Lines sold at CRS group code level."
      countingLevelLabel="CRS group code"
      defaults={TLSD_DEFAULTS}
      defaultKeyNotes={DEFAULT_TLSD_KEY_NOTES}
      {...props}
    />
  );
}

export function DbbTemplateCard(props: WrapperProps = {}) {
  return (
    <LinesTemplateCard
      selfId="dbb"
      title="DBB — Distribution Big Bet"
      tag="Distribution"
      description="Lines of client-designated focus SKUs at CRS group code level."
      countingLevelLabel="CRS group code"
      showFocusSkuUpload
      defaults={DBB_DEFAULTS}
      defaultKeyNotes={DEFAULT_DBB_KEY_NOTES}
      {...props}
    />
  );
}
