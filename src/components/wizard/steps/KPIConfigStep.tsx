import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Lock,
  Plus,
  Settings,
  Trash2,
  Upload,
  AlertTriangle,
  Info,
} from "lucide-react";
import { mockProgrammes } from "@/data/mockData";
import type { AudienceState } from "./AudienceStep";
import type {
  Programme,
  KpiConfig,
  GateConditions,
  ChannelFocusTier,
  DataFeedType,
} from "@/types/programme";

// ─── Types ──────────────────────────────────────────────────────────────────
type KpiKey = keyof Programme["kpis"];

export interface KpiStepValue {
  kpis: Programme["kpis"];
  gates: GateConditions;
  sourceProgrammeId: string | null;
}

export const emptyKpiStepValue: KpiStepValue = {
  kpis: {},
  gates: {
    nsvMinPct: 95,
    cftUrbanHrs: 4,
    cftRuralHrs: 3,
    cftMinWorkingDays: 17,
    cftPenaltyPct: 50,
    ecoZeroNetValueExcluded: true,
    ecoDoubleCountsSameDayBilling: true,
    partialMonthProRata: true,
  },
  sourceProgrammeId: null,
};

// ─── KPI metadata ───────────────────────────────────────────────────────────
const KPI_META: Record<
  KpiKey,
  { letter: string; name: string; editor: EditorKind; mandatory?: boolean }
> = {
  A_nsv: { letter: "A", name: "NSV Achievement", editor: "auto-nsv", mandatory: true },
  B_phasing: { letter: "B", name: "NSV Phasing", editor: "phasing" },
  C_eco: { letter: "C", name: "ECO — Effective Coverage", editor: "eco" },
  D_tlsd: { letter: "D", name: "TLSD / Lines Sold", editor: "perline" },
  E_dbb: { letter: "E", name: "DBB — Distinct Brands Billed", editor: "perline" },
  F_cft: { letter: "F", name: "CFT — Customer Facing Time", editor: "appusage" },
  G_subDbBilling: { letter: "G", name: "Sub-DB Billing", editor: "flat" },
  H_msb: { letter: "H", name: "MSB — Min Brands per Sub-DB", editor: "flat" },
  I_channelFocus: { letter: "I", name: "Channel Focus", editor: "channel-focus" },
  J_teamEarning: { letter: "J", name: "Team Earning", editor: "team-earning" },
  K_appUsage: { letter: "K", name: "SW App Usage", editor: "appusage" },
  L_quarterly: { letter: "L", name: "Quarterly NSV (Q1)", editor: "linear" },
};

type EditorKind =
  | "linear"
  | "tiered"
  | "phasing"
  | "eco"
  | "perline"
  | "flat"
  | "channel-focus"
  | "team-earning"
  | "appusage"
  | "auto-nsv";

const FEED_BADGE: Record<
  DataFeedType,
  { label: string; cls: string }
> = {
  "ai-ml": { label: "AI/ML", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  "mdm-upload": { label: "MDM Upload", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  proxy: { label: "Proxy", cls: "bg-muted text-muted-foreground border-border" },
  manual: { label: "Manual", cls: "bg-green-100 text-green-700 border-green-200" },
};

// ─── Programme matching (uses same logic as AudienceStep) ───────────────────
function matchProgramme(a: AudienceState): Programme | null {
  if (!a.channel || !a.role) return null;
  return (
    mockProgrammes.find((p) => {
      if (p.channel !== a.channel) return false;
      if (p.role !== a.role) return false;
      const wantsKerala = a.geography === "kerala";
      const isKeralaProg = p.geography === "kerala";
      if (wantsKerala !== isKeralaProg) return false;
      if (a.channel === "CCD" && a.role === "ASO_ASE") return true;
      if (!a.segment) return false;
      return p.segment === a.segment;
    }) ?? null
  );
}

// Determine which KPIs are *applicable* for a given audience.
function applicableKpis(a: AudienceState): KpiKey[] {
  const matched = matchProgramme(a);
  if (matched) return Object.keys(matched.kpis) as KpiKey[];
  // Fallback: show core 5
  return ["A_nsv", "B_phasing", "C_eco", "D_tlsd", "E_dbb"];
}

function isMandatory(kpi: KpiKey): boolean {
  return KPI_META[kpi].mandatory === true;
}

// Derive a programme-type label for the subtitle.
function derivedLabel(a: AudienceState): string {
  const parts: string[] = [];
  if (a.channel) parts.push(a.channel);
  if (a.role) parts.push(a.role.replace("_", "/"));
  if (a.segment) parts.push(a.segment.replace("-", " "));
  if (a.geography === "kerala") parts.push("Kerala");
  return parts.length ? parts.join(" · ") : "this programme";
}

// Compute the max payout for a single KPI based on its config.
function maxPayoutForKpi(key: KpiKey, cfg?: KpiConfig): number {
  if (!cfg || !cfg.enabled) return 0;
  if (cfg.linearSlab) return cfg.linearSlab.capAmount;
  if (cfg.tieredSlab) return Math.max(...cfg.tieredSlab.tiers.map((t) => t.payout));
  if (cfg.phasingSlab) return cfg.phasingSlab.t75;
  if (cfg.ecoConfig) return cfg.ecoConfig.maxPayout;
  if (cfg.perLineSlab) return cfg.perLineSlab.maxPayout;
  if (cfg.flatTrigger) return cfg.flatTrigger.payout;
  if (cfg.channelFocusTiers)
    return cfg.channelFocusTiers.reduce((sum, t) => sum + t.t100, 0);
  if (cfg.payoutAmount) return cfg.payoutAmount;
  return 0;
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ─── Component ──────────────────────────────────────────────────────────────
interface Props {
  audience: AudienceState;
  value: KpiStepValue;
  onChange: (next: KpiStepValue) => void;
}

export function KPIConfigStep({ audience, value, onChange }: Props) {
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);

  // Pre-populate from matched programme on first mount or audience change.
  const matched = useMemo(() => matchProgramme(audience), [audience]);
  useEffect(() => {
    if (!matched) return;
    if (value.sourceProgrammeId === matched.id) return;
    onChange({
      kpis: JSON.parse(JSON.stringify(matched.kpis)),
      gates: { ...matched.gates },
      sourceProgrammeId: matched.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched?.id]);

  const applicable = useMemo(() => applicableKpis(audience), [audience]);

  // Set the first applicable KPI as active by default.
  useEffect(() => {
    if (!activeKpi && applicable.length) setActiveKpi(applicable[0]);
  }, [applicable, activeKpi]);

  const updateKpi = (key: KpiKey, patch: Partial<KpiConfig>) => {
    const current = value.kpis[key] ?? { enabled: false, dataFeed: "ai-ml" };
    onChange({
      ...value,
      kpis: { ...value.kpis, [key]: { ...current, ...patch } },
    });
  };

  const setGates = (patch: Partial<GateConditions>) => {
    onChange({ ...value, gates: { ...value.gates, ...patch } });
  };

  // Compute totals
  const totalMonthly = applicable.reduce(
    (sum, k) => sum + maxPayoutForKpi(k, value.kpis[k]),
    0,
  );
  const quarterlyExtra = value.kpis.L_quarterly?.enabled
    ? maxPayoutForKpi("L_quarterly", value.kpis.L_quarterly)
    : 0;
  const totalMonthlyExclQuarterly = totalMonthly - quarterlyExtra;
  const totalQ1 = totalMonthlyExclQuarterly * 3 + quarterlyExtra;

  const isKerala = audience.geography === "kerala";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="animate-fade-in space-y-4">
        {/* Header */}
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Configure KPIs</h2>
          <p className="text-xs text-muted-foreground">
            All thresholds, rates and payouts are editable. The programme auto-loaded
            the defaults for <span className="font-medium text-foreground">{derivedLabel(audience)}</span>.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,30%)_1fr] gap-4">
          {/* ── LEFT: KPI list ─────────────────────────────────────────── */}
          <Card className="p-2 space-y-1 self-start">
            {applicable.map((key) => {
              const meta = KPI_META[key];
              const cfg = value.kpis[key];
              const enabled = cfg?.enabled ?? false;
              const max = maxPayoutForKpi(key, cfg);
              const feed = cfg?.dataFeed ?? "ai-ml";
              const mandatory = isMandatory(key);
              const excluded =
                isKerala && (key === "C_eco" || key === "D_tlsd" || key === "E_dbb");

              const row = (
                <button
                  key={key}
                  type="button"
                  disabled={excluded}
                  onClick={() => !excluded && setActiveKpi(key)}
                  className={cn(
                    "w-full text-left rounded-md border px-2 py-2 transition-colors",
                    activeKpi === key && !excluded
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted/40",
                    excluded && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {mandatory ? (
                      <Lock size={12} className="text-muted-foreground shrink-0" />
                    ) : (
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => updateKpi(key, { enabled: v })}
                        onClick={(e) => e.stopPropagation()}
                        disabled={excluded}
                        className="scale-75 -ml-1"
                      />
                    )}
                    <span className="w-5 h-5 rounded bg-muted text-[10px] font-bold flex items-center justify-center shrink-0">
                      {meta.letter}
                    </span>
                    <span className="text-xs font-medium flex-1 truncate">
                      {meta.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 ml-7 flex-wrap">
                    {enabled && max > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        Max {fmt(max)}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0 h-4", FEED_BADGE[feed].cls)}
                    >
                      {FEED_BADGE[feed].label}
                    </Badge>
                  </div>
                </button>
              );

              return excluded ? (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>{row}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-xs">Not applicable for Kerala programmes.</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                row
              );
            })}

            {/* Totals */}
            <div className="border-t pt-2 mt-2 space-y-1 px-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Max monthly</span>
                <span className="font-semibold text-foreground">{fmt(totalMonthly)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Max Q1 earning</span>
                <span className="font-semibold text-primary">{fmt(totalQ1)}</span>
              </div>
            </div>
          </Card>

          {/* ── RIGHT: Editor ──────────────────────────────────────────── */}
          <div className="min-w-0">
            {activeKpi ? (
              <KpiEditor
                kpiKey={activeKpi}
                cfg={value.kpis[activeKpi]}
                audience={audience}
                onChange={(patch) => updateKpi(activeKpi, patch)}
              />
            ) : (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Select a KPI on the left to configure.
              </Card>
            )}
          </div>
        </div>

        {/* Gate Conditions (collapsible) */}
        <GatesPanel
          gates={value.gates}
          onChange={setGates}
          showCollectionGate={
            audience.role === "ASO_ASE" || audience.role === "ASO" || audience.role === "ASM"
          }
        />
      </div>
    </TooltipProvider>
  );
}

// ─── Editor router ──────────────────────────────────────────────────────────
function KpiEditor({
  kpiKey,
  cfg,
  audience,
  onChange,
}: {
  kpiKey: KpiKey;
  cfg?: KpiConfig;
  audience: AudienceState;
  onChange: (patch: Partial<KpiConfig>) => void;
}) {
  const meta = KPI_META[kpiKey];
  const safeCfg: KpiConfig = cfg ?? { enabled: false, dataFeed: "ai-ml" };

  // Auto-decide NSV editor (linear vs tiered) based on what data is present.
  let editor: EditorKind = meta.editor;
  if (editor === "auto-nsv") {
    editor = safeCfg.tieredSlab ? "tiered" : "linear";
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            {meta.letter}. {meta.name}
          </h3>
          {safeCfg.nsvBasis && (
            <p className="text-[11px] text-muted-foreground">
              NSV basis: <span className="font-medium">{safeCfg.nsvBasis}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground">Data feed</Label>
          <Select
            value={safeCfg.dataFeed}
            onValueChange={(v) => onChange({ dataFeed: v as DataFeedType })}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ai-ml">AI/ML</SelectItem>
              <SelectItem value="mdm-upload">MDM Upload</SelectItem>
              <SelectItem value="proxy">Proxy</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {safeCfg.dataFeed === "mdm-upload" && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-orange-50 border border-orange-200 text-[11px] text-orange-800">
          <Upload size={12} className="mt-0.5 shrink-0" />
          <span>
            Upload required — targets must be provided by Emami via MDM before programme
            goes live.
          </span>
        </div>
      )}

      {editor === "linear" && (
        <LinearSlabEditor cfg={safeCfg} onChange={onChange} />
      )}
      {editor === "tiered" && (
        <TieredSlabEditor cfg={safeCfg} onChange={onChange} />
      )}
      {editor === "phasing" && (
        <PhasingEditor cfg={safeCfg} onChange={onChange} nsvMin={95} />
      )}
      {editor === "eco" && (
        <EcoEditor cfg={safeCfg} onChange={onChange} channel={audience.channel} />
      )}
      {editor === "perline" && (
        <PerLineEditor cfg={safeCfg} onChange={onChange} />
      )}
      {editor === "flat" && (
        <FlatTriggerEditor cfg={safeCfg} onChange={onChange} kpiKey={kpiKey} />
      )}
      {editor === "channel-focus" && (
        <ChannelFocusEditor cfg={safeCfg} onChange={onChange} />
      )}
      {editor === "team-earning" && (
        <TeamEarningEditor cfg={safeCfg} onChange={onChange} />
      )}
      {editor === "appusage" && (
        <AppUsageEditor cfg={safeCfg} onChange={onChange} kpiKey={kpiKey} />
      )}
    </Card>
  );
}

// ─── 1. Linear Slab Editor ──────────────────────────────────────────────────
function LinearSlabEditor({
  cfg,
  onChange,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
}) {
  const slab = cfg.linearSlab ?? { entryAmount: 2400, stepRate: 320, minPct: 95, capAmount: 6000 };
  const set = (patch: Partial<typeof slab>) =>
    onChange({ linearSlab: { ...slab, ...patch } });

  // Calculate cap pct
  const stepsToCap = slab.stepRate > 0 ? Math.ceil((slab.capAmount - slab.entryAmount) / slab.stepRate) : 0;
  const capPct = slab.minPct + stepsToCap;

  const rows: Array<{ pct: string; amt: number; note?: string; tone?: "red" | "grey" }> = [];
  rows.push({ pct: `< ${slab.minPct}%`, amt: 0, note: "Below threshold", tone: "red" });
  for (let p = slab.minPct; p <= capPct && p < slab.minPct + 12; p++) {
    const amt = Math.min(slab.entryAmount + (p - slab.minPct) * slab.stepRate, slab.capAmount);
    rows.push({ pct: `${p}%`, amt });
  }
  rows.push({ pct: `≥ ${capPct}%`, amt: slab.capAmount, note: "Cap reached", tone: "grey" });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Entry threshold (%)" value={slab.minPct} onChange={(v) => set({ minPct: v })} />
        <Field label="Entry payout (₹)" value={slab.entryAmount} onChange={(v) => set({ entryAmount: v })} />
        <Field label="Step rate per 1% (₹)" value={slab.stepRate} onChange={(v) => set({ stepRate: v })} />
        <Field label="Maximum cap (₹)" value={slab.capAmount} onChange={(v) => set({ capAmount: v })} />
      </div>
      <PreviewTable
        cols={["Achievement %", "Payout"]}
        rows={rows.map((r) => ({
          cells: [r.pct, fmt(r.amt)],
          tone: r.tone,
          note: r.note,
        }))}
      />
      <p className="text-[11px] text-muted-foreground italic">
        Cap reached at approximately {capPct}%.
      </p>
    </div>
  );
}

// ─── 2. Tiered Slab Editor ──────────────────────────────────────────────────
function TieredSlabEditor({
  cfg,
  onChange,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
}) {
  const tiers = cfg.tieredSlab?.tiers ?? [
    { thresholdPct: 90, payout: 1000, label: "90%" },
    { thresholdPct: 100, payout: 2000, label: "100%" },
  ];
  const setTiers = (next: typeof tiers) =>
    onChange({ tieredSlab: { tiers: next } });

  const updateTier = (i: number, patch: Partial<(typeof tiers)[number]>) => {
    const next = tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    setTiers(next);
  };

  const addTier = () => {
    if (tiers.length >= 6) return;
    const last = tiers[tiers.length - 1];
    setTiers([
      ...tiers,
      { thresholdPct: last.thresholdPct + 5, payout: last.payout + 500, label: `${last.thresholdPct + 5}%` },
    ]);
  };

  const removeTier = (i: number) => {
    if (tiers.length <= 2) return;
    setTiers(tiers.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
            <Field
              label={i === 0 ? "Threshold (%)" : ""}
              value={t.thresholdPct}
              onChange={(v) => updateTier(i, { thresholdPct: v })}
            />
            <Field
              label={i === 0 ? "Payout (₹)" : ""}
              value={t.payout}
              onChange={(v) => updateTier(i, { payout: v })}
            />
            <div>
              {i === 0 && <Label className="text-[11px] text-muted-foreground">Label</Label>}
              <Input
                value={t.label}
                onChange={(e) => updateTier(i, { label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 mt-4"
              onClick={() => removeTier(i)}
              disabled={tiers.length <= 2}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={addTier}
        disabled={tiers.length >= 6}
        className="text-xs gap-1"
      >
        <Plus size={12} /> Add tier
      </Button>
      <PreviewTable
        cols={["Tier", "Threshold", "Payout"]}
        rows={[
          { cells: ["Below entry", `< ${tiers[0].thresholdPct}%`, "₹0"], tone: "red" },
          ...tiers.map((t) => ({ cells: [t.label, `≥ ${t.thresholdPct}%`, fmt(t.payout)] })),
        ]}
      />
    </div>
  );
}

// ─── 3. Phasing Editor ──────────────────────────────────────────────────────
function PhasingEditor({
  cfg,
  onChange,
  nsvMin,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
  nsvMin: number;
}) {
  const slab = cfg.phasingSlab ?? { t55: 0, t65: 0, t70: 0, t75: 0 };
  const set = (patch: Partial<typeof slab>) =>
    onChange({ phasingSlab: { ...slab, ...patch } });

  const rows: Array<["t55" | "t65" | "t70" | "t75", number]> = [
    ["t55", 55],
    ["t65", 65],
    ["t70", 70],
    ["t75", 75],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div className="text-[11px] font-medium text-muted-foreground px-2">
          Achievement by 20th
        </div>
        <div className="text-[11px] font-medium text-muted-foreground px-2">Payout (₹)</div>
        {rows.map(([key, pct]) => (
          <div key={key} className="contents">
            <div className="px-2 py-2 rounded-md bg-muted/40 text-xs font-medium">{pct}%</div>
            <Input
              type="number"
              value={slab[key]}
              onChange={(e) => set({ [key]: Number(e.target.value) || 0 } as Partial<typeof slab>)}
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground italic flex items-start gap-1">
        <Info size={11} className="mt-0.5 shrink-0" />
        Requires full-month NSV ≥ {nsvMin}% — configured in Gate settings below.
      </p>
    </div>
  );
}

// ─── 4. ECO Editor ──────────────────────────────────────────────────────────
function EcoEditor({
  cfg,
  onChange,
  channel,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
  channel: AudienceState["channel"];
}) {
  // HCD ECO uses tiered slabs (MDM-driven), not the linear ECO config.
  if (channel === "HCD") {
    return <TieredSlabEditor cfg={cfg} onChange={onChange} />;
  }

  const eco = cfg.ecoConfig ?? {
    minBillValue: 250,
    minOutlets: 100,
    maxOutlets: 250,
    ratePerOutlet: 2,
    maxPayout: 500,
  };
  const set = (patch: Partial<typeof eco>) =>
    onChange({ ecoConfig: { ...eco, ...patch } });

  const rows: Array<{ outlets: number; amt: number; tone?: "red" | "grey" }> = [];
  rows.push({ outlets: eco.minOutlets - 1, amt: 0, tone: "red" });
  const step = Math.max(1, Math.ceil((eco.maxOutlets - eco.minOutlets) / 6));
  for (let o = eco.minOutlets; o <= eco.maxOutlets; o += step) {
    rows.push({ outlets: o, amt: Math.min(o * eco.ratePerOutlet, eco.maxPayout) });
  }
  rows.push({ outlets: eco.maxOutlets, amt: eco.maxPayout, tone: "grey" });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Field label="Min bill value (₹)" value={eco.minBillValue} onChange={(v) => set({ minBillValue: v })} />
        <Field label="Min outlets" value={eco.minOutlets} onChange={(v) => set({ minOutlets: v })} />
        <Field label="Max outlets" value={eco.maxOutlets} onChange={(v) => set({ maxOutlets: v })} />
        <Field label="Rate per outlet (₹)" value={eco.ratePerOutlet} onChange={(v) => set({ ratePerOutlet: v })} />
        <Field label="Max payout (₹)" value={eco.maxPayout} onChange={(v) => set({ maxPayout: v })} />
      </div>
      <PreviewTable
        cols={["Outlets", "Payout"]}
        rows={rows.map((r) => ({
          cells: [`${r.outlets}`, fmt(r.amt)],
          tone: r.tone,
        }))}
      />
    </div>
  );
}

// ─── 5. Per-Line Editor ─────────────────────────────────────────────────────
function PerLineEditor({
  cfg,
  onChange,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
}) {
  const slab = cfg.perLineSlab ?? { minLines: 100, maxLines: 300, ratePerLine: 5, maxPayout: 1500 };
  const set = (patch: Partial<typeof slab>) =>
    onChange({ perLineSlab: { ...slab, ...patch } });

  const rows: Array<{ lines: number; amt: number; tone?: "red" | "grey" }> = [];
  rows.push({ lines: slab.minLines - 1, amt: 0, tone: "red" });
  const step = Math.max(1, Math.ceil((slab.maxLines - slab.minLines) / 6));
  for (let l = slab.minLines; l <= slab.maxLines; l += step) {
    rows.push({ lines: l, amt: Math.min(l * slab.ratePerLine, slab.maxPayout) });
  }
  rows.push({ lines: slab.maxLines, amt: slab.maxPayout, tone: "grey" });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Min lines" value={slab.minLines} onChange={(v) => set({ minLines: v })} />
        <Field label="Max lines" value={slab.maxLines} onChange={(v) => set({ maxLines: v })} />
        <Field label="Rate per line (₹)" value={slab.ratePerLine} onChange={(v) => set({ ratePerLine: v })} />
        <Field label="Max payout (₹)" value={slab.maxPayout} onChange={(v) => set({ maxPayout: v })} />
      </div>
      <PreviewTable
        cols={["Lines", "Payout"]}
        rows={rows.map((r) => ({ cells: [`${r.lines}`, fmt(r.amt)], tone: r.tone }))}
      />
    </div>
  );
}

// ─── 6. Flat Trigger Editor ─────────────────────────────────────────────────
function FlatTriggerEditor({
  cfg,
  onChange,
  kpiKey,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
  kpiKey: KpiKey;
}) {
  const trig = cfg.flatTrigger ?? { thresholdPct: 80, payout: 1000 };
  const set = (patch: Partial<typeof trig>) =>
    onChange({ flatTrigger: { ...trig, ...patch } });

  const isMsb = kpiKey === "H_msb";
  const thresholdLabel = isMsb ? "Min brands per Sub-DB" : "% of L3M baseline";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label={thresholdLabel} value={trig.thresholdPct} onChange={(v) => set({ thresholdPct: v })} />
        <Field label="Flat payout (₹)" value={trig.payout} onChange={(v) => set({ payout: v })} />
      </div>
      <PreviewTable
        cols={["Condition", "Payout"]}
        rows={[
          { cells: [`Below ${trig.thresholdPct}${isMsb ? " brands" : "%"}`, "₹0"], tone: "red" },
          { cells: [`≥ ${trig.thresholdPct}${isMsb ? " brands" : "%"}`, fmt(trig.payout)] },
        ]}
      />
    </div>
  );
}

// ─── 7. Channel Focus Editor ────────────────────────────────────────────────
function ChannelFocusEditor({
  cfg,
  onChange,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
}) {
  const tiers: ChannelFocusTier[] = cfg.channelFocusTiers ?? [];
  const setTiers = (next: ChannelFocusTier[]) =>
    onChange({ channelFocusTiers: next });
  const update = (i: number, patch: Partial<ChannelFocusTier>) =>
    setTiers(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-muted-foreground text-[11px]">
            <th className="text-left p-1 font-medium">Channel</th>
            <th className="p-1 font-medium">90%</th>
            <th className="p-1 font-medium">95%</th>
            <th className="p-1 font-medium">100%</th>
            <th className="p-1 font-medium">ECO wt</th>
            <th className="p-1 font-medium">Sales wt</th>
            <th className="p-1 font-medium">Timing</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => (
            <tr key={i} className="border-t">
              <td className="p-1 font-medium">{t.channelName}</td>
              <td className="p-1">
                <Input type="number" value={t.t90} onChange={(e) => update(i, { t90: Number(e.target.value) || 0 })} className="h-7 text-xs w-20" />
              </td>
              <td className="p-1">
                <Input type="number" value={t.t95} onChange={(e) => update(i, { t95: Number(e.target.value) || 0 })} className="h-7 text-xs w-20" />
              </td>
              <td className="p-1">
                <Input type="number" value={t.t100} onChange={(e) => update(i, { t100: Number(e.target.value) || 0 })} className="h-7 text-xs w-20" />
              </td>
              <td className="p-1">
                <Input type="number" value={t.ecoWeight} onChange={(e) => update(i, { ecoWeight: Number(e.target.value) || 0 })} className="h-7 text-xs w-16" />
              </td>
              <td className="p-1">
                <Input type="number" value={t.salesWeight} onChange={(e) => update(i, { salesWeight: Number(e.target.value) || 0 })} className="h-7 text-xs w-16" />
              </td>
              <td className="p-1">
                <Select value={t.timing} onValueChange={(v) => update(i, { timing: v as ChannelFocusTier["timing"] })}>
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="may-jun">May+Jun</SelectItem>
                    <SelectItem value="after-jun">After Jun</SelectItem>
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 8. Team Earning Editor ─────────────────────────────────────────────────
function TeamEarningEditor({
  cfg,
  onChange,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
}) {
  const budgeted = cfg.budgetedCount ?? 5;
  const total = cfg.payoutAmount ?? 4000;
  const subs = [
    "MR Value Earner",
    "MR ECO Earner",
    "MR TLSD/Lines Earner",
    "SW App Usage Earner",
  ];
  const per = Math.round(total / subs.length);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Budgeted MR count (from Emami)"
          value={budgeted}
          onChange={(v) => onChange({ budgetedCount: v })}
        />
        <Field
          label="Total team payout (₹)"
          value={total}
          onChange={(v) => onChange({ payoutAmount: v })}
        />
      </div>
      <div className="space-y-1">
        {subs.map((s) => (
          <div key={s} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
            <Switch defaultChecked className="scale-75" />
            <span className="text-xs flex-1">{s}</span>
            <span className="text-xs font-semibold">{fmt(per)}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground italic flex items-start gap-1">
        <Info size={11} className="mt-0.5 shrink-0" />
        Gate condition: ({budgeted} − 1) MRs must achieve 100% of each sub-component.
      </p>
    </div>
  );
}

// ─── 9. SW App Usage / CFT Editor ───────────────────────────────────────────
function AppUsageEditor({
  cfg,
  onChange,
  kpiKey,
}: {
  cfg: KpiConfig;
  onChange: (patch: Partial<KpiConfig>) => void;
  kpiKey: KpiKey;
}) {
  const urban = cfg.urbanHrsThreshold ?? 4;
  const rural = cfg.ruralHrsThreshold ?? 3;
  const payout = cfg.payoutAmount ?? 1000;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Urban hours threshold" value={urban} onChange={(v) => onChange({ urbanHrsThreshold: v })} />
        <Field label="Rural hours threshold" value={rural} onChange={(v) => onChange({ ruralHrsThreshold: v })} />
        <Field label="Monthly payout (₹)" value={payout} onChange={(v) => onChange({ payoutAmount: v })} />
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        {kpiKey === "K_appUsage"
          ? "Activities counted: FC/LC, Top Retail Working, WS Working, Cross Beat, Cross MR."
          : "Hours captured via Salescode app. Min working days from gate config."}
      </p>
    </div>
  );
}

// ─── Reusable Field ─────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      {label && <Label className="text-[11px] text-muted-foreground">{label}</Label>}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8 text-xs"
      />
    </div>
  );
}

// ─── Reusable Preview Table ─────────────────────────────────────────────────
function PreviewTable({
  cols,
  rows,
}: {
  cols: string[];
  rows: Array<{ cells: string[]; tone?: "red" | "grey"; note?: string }>;
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            {cols.map((c) => (
              <th key={c} className="text-left px-3 py-1.5 font-medium text-muted-foreground">
                {c}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={cn(
                "border-t",
                r.tone === "red" && "bg-red-50/60",
                r.tone === "grey" && "bg-muted/30",
              )}
            >
              {r.cells.map((c, j) => (
                <td key={j} className="px-3 py-1.5">
                  {c}
                </td>
              ))}
              <td className="px-3 py-1.5 text-[11px] text-muted-foreground italic">
                {r.note ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Gates Panel ────────────────────────────────────────────────────────────
function GatesPanel({
  gates,
  onChange,
  showCollectionGate,
}: {
  gates: GateConditions;
  onChange: (patch: Partial<GateConditions>) => void;
  showCollectionGate: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-muted-foreground" />
              <span className="text-sm font-semibold">Gate Conditions & Rules</span>
            </div>
            <ChevronDown
              size={14}
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3 border-t">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field
                label="NSV minimum (%)"
                value={gates.nsvMinPct}
                onChange={(v) => onChange({ nsvMinPct: v })}
              />
              {showCollectionGate && (
                <Field
                  label="GT Collection gate (%)"
                  value={gates.gtCollectionMinPct ?? 90}
                  onChange={(v) => onChange({ gtCollectionMinPct: v })}
                />
              )}
              <Field
                label="CFT min working days"
                value={gates.cftMinWorkingDays}
                onChange={(v) => onChange({ cftMinWorkingDays: v })}
              />
              <Field
                label="CFT urban hrs"
                value={gates.cftUrbanHrs}
                onChange={(v) => onChange({ cftUrbanHrs: v })}
              />
              <Field
                label="CFT rural hrs"
                value={gates.cftRuralHrs}
                onChange={(v) => onChange({ cftRuralHrs: v })}
              />
              <Field
                label="CFT penalty (%)"
                value={gates.cftPenaltyPct}
                onChange={(v) => onChange({ cftPenaltyPct: v })}
              />
            </div>
            <div className="space-y-2 pt-2 border-t">
              <ToggleRow
                label="ECO zero-net-value exclusion"
                checked={gates.ecoZeroNetValueExcluded}
                onChange={(v) => onChange({ ecoZeroNetValueExcluded: v })}
              />
              <ToggleRow
                label="ECO same-day double billing counts as 2 events"
                checked={gates.ecoDoubleCountsSameDayBilling}
                onChange={(v) => onChange({ ecoDoubleCountsSameDayBilling: v })}
              />
              <ToggleRow
                label="Partial month pro-rata"
                checked={gates.partialMonthProRata}
                onChange={(v) => onChange({ partialMonthProRata: v })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
