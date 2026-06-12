// AI Recommended Order KPI template.
// Incentivises sales reps for complying with the SFA AI/ML one-click order recommendation —
// composed of a Cross-sell SKU (new push) and a Recover SKU (regular upsell).
// Per sub-metric the user can choose:
//   • Payout basis: monthly % compliance (slabs) or per-line (₹ × lines complied)
//   • Compliance type: SKU only (was the recommended SKU bought?) or SKU + Qty (≥ recommended qty)

import { useMemo } from "react";
import { Plus, Trash2, Sparkles, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useControlled } from "./useControlled";
import { KeyNotesSection } from "./KeyNotesSection";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type AiRecoPayoutBasis = "monthly_pct" | "per_line";
export type AiRecoComplianceType = "sku_only" | "sku_and_qty";

export interface AiRecoSlab {
  /** % of recommendations complied */
  threshold: number;
  /** Cumulative ₹ payout when threshold is achieved */
  payout: number;
}

export interface AiRecoPerLineConfig {
  ratePerLine: number;
  minLines: number;
  maxLines: number;
}

export interface AiRecoSubMetricConfig {
  enabled: boolean;
  payoutBasis: AiRecoPayoutBasis;
  complianceType: AiRecoComplianceType;
  slabs: AiRecoSlab[];
  perLine: AiRecoPerLineConfig;
}

export interface AiRecommendedOrderConfig {
  crossSell: AiRecoSubMetricConfig;
  recover: AiRecoSubMetricConfig;
  keyNotes: string[];
}

const DEFAULT_SLABS: AiRecoSlab[] = [
  { threshold: 60, payout: 500 },
  { threshold: 80, payout: 1200 },
  { threshold: 100, payout: 2000 },
];

const DEFAULT_PER_LINE: AiRecoPerLineConfig = {
  ratePerLine: 2,
  minLines: 50,
  maxLines: 1000,
};

export const DEFAULT_AI_RECO_KEY_NOTES = [
  "Recommendation = one-click order suggested by the SFA AI/ML engine for a specific outlet.",
  "SKU compliance = the recommended SKU was billed at the outlet. Qty compliance additionally requires billed qty ≥ recommended qty.",
  "Any SKU within the same CRS / group code as the recommended SKU also counts towards your compliance.",
  "Monthly % compliance = complied recommendations ÷ recommendations served in the period. Per-line basis pays ₹ for every complied line.",
];

const defaultSub = (): AiRecoSubMetricConfig => ({
  enabled: true,
  payoutBasis: "monthly_pct",
  complianceType: "sku_and_qty",
  slabs: structuredClone(DEFAULT_SLABS),
  perLine: { ...DEFAULT_PER_LINE },
});

export const DEFAULT_AI_RECO: AiRecommendedOrderConfig = {
  crossSell: defaultSub(),
  recover: defaultSub(),
  keyNotes: [...DEFAULT_AI_RECO_KEY_NOTES],
};

function subMax(s: AiRecoSubMetricConfig): number {
  if (!s.enabled) return 0;
  if (s.payoutBasis === "per_line") {
    return Math.max(0, s.perLine.maxLines * s.perLine.ratePerLine);
  }
  if (!s.slabs.length) return 0;
  return s.slabs.reduce((m, x) => Math.max(m, x.payout), 0);
}

export function aiRecoMaxPayout(c: AiRecommendedOrderConfig): number {
  return subMax(c.crossSell) + subMax(c.recover);
}

export function aiRecoSummary(c: AiRecommendedOrderConfig): string {
  const parts: string[] = [];
  if (c.crossSell.enabled) parts.push(`Cross-sell ${fmt(subMax(c.crossSell))}`);
  if (c.recover.enabled) parts.push(`Recover ${fmt(subMax(c.recover))}`);
  if (!parts.length) return "No sub-metrics enabled";
  return `${parts.join(" + ")} · max ${fmt(aiRecoMaxPayout(c))}`;
}

interface Props {
  value?: AiRecommendedOrderConfig;
  onChange?: (v: AiRecommendedOrderConfig) => void;
}

interface SubEditorProps {
  title: string;
  subtitle: string;
  cfg: AiRecoSubMetricConfig;
  onChange: (next: AiRecoSubMetricConfig) => void;
}

function SegToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs rounded-sm transition ${
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SubMetricEditor({ title, subtitle, cfg, onChange }: SubEditorProps) {
  const sorted = useMemo(() => [...cfg.slabs].sort((a, b) => a.threshold - b.threshold), [cfg.slabs]);
  const top = sorted.length ? sorted[sorted.length - 1].payout : 0;
  const unsorted = cfg.slabs.some((s, i) => i > 0 && s.threshold <= cfg.slabs[i - 1].threshold);
  const nonMono = cfg.slabs.some((s, i) => i > 0 && s.payout < cfg.slabs[i - 1].payout);
  const perLineMax = cfg.perLine.maxLines * cfg.perLine.ratePerLine;
  const invalidLineRange = cfg.perLine.maxLines <= cfg.perLine.minLines;

  const updateSlab = (idx: number, patch: Partial<AiRecoSlab>) =>
    onChange({ ...cfg, slabs: cfg.slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  const addSlab = () => {
    const last = cfg.slabs[cfg.slabs.length - 1];
    onChange({
      ...cfg,
      slabs: [
        ...cfg.slabs,
        {
          threshold: Math.min(100, (last?.threshold ?? 0) + 5),
          payout: Math.round((last?.payout ?? 0) * 1.25),
        },
      ],
    });
  };
  const removeSlab = (idx: number) =>
    onChange({ ...cfg, slabs: cfg.slabs.filter((_, i) => i !== idx) });

  const headerMax = cfg.payoutBasis === "per_line" ? perLineMax : top;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-start justify-between px-4 py-3 bg-muted/30 border-b border-border gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant="outline" className="text-[10px]">
              {cfg.complianceType === "sku_only" ? "SKU compliance" : "SKU + Qty compliance"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {cfg.payoutBasis === "per_line" ? "Per-line payout" : "Monthly % compliance"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            {cfg.enabled ? `Max ${fmt(headerMax)}` : "Disabled"}
          </span>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => onChange({ ...cfg, enabled: v })}
          />
        </div>
      </div>

      {cfg.enabled && (
        <div className="p-4 space-y-4">
          {/* Compliance type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Compliance type
            </Label>
            <div className="flex items-center gap-3 flex-wrap">
              <SegToggle
                value={cfg.complianceType}
                onChange={(v) => onChange({ ...cfg, complianceType: v })}
                options={[
                  { value: "sku_only", label: "SKU only" },
                  { value: "sku_and_qty", label: "SKU + Qty (≥ recommended)" },
                ]}
              />
              <p className="text-[11px] text-muted-foreground flex-1 min-w-[200px]">
                {cfg.complianceType === "sku_only"
                  ? "Counts as complied as long as the recommended SKU (or CRS-equivalent) is billed — quantity is ignored."
                  : "Recommended SKU (or CRS-equivalent) must be billed at the recommended quantity or higher."}
              </p>
            </div>
          </div>

          {/* Payout basis */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Payout basis
            </Label>
            <div className="flex items-center gap-3 flex-wrap">
              <SegToggle
                value={cfg.payoutBasis}
                onChange={(v) => onChange({ ...cfg, payoutBasis: v })}
                options={[
                  { value: "monthly_pct", label: "Monthly % compliance" },
                  { value: "per_line", label: "Per-line ₹" },
                ]}
              />
              <p className="text-[11px] text-muted-foreground flex-1 min-w-[200px]">
                {cfg.payoutBasis === "monthly_pct"
                  ? "Slab-based — rep is paid at the end of the period based on % of recommendations complied."
                  : "Pays a fixed ₹ for every complied recommendation line within min/max bounds."}
              </p>
            </div>
          </div>

          {/* Editor switches on basis */}
          {cfg.payoutBasis === "monthly_pct" ? (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Slabs (% complied → ₹ payout)
                </Label>
                <Button variant="outline" size="sm" onClick={addSlab} className="gap-1 h-7">
                  <Plus size={12} /> Add slab
                </Button>
              </div>

              <div className="border border-border rounded-md overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-3 py-2 bg-muted/40 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  <div>Threshold</div>
                  <div>Cumulative payout</div>
                  <div>Δ vs previous</div>
                  <div className="w-8" />
                </div>
                {cfg.slabs.map((s, i) => {
                  const prev = i === 0 ? 0 : cfg.slabs[i - 1].payout;
                  const delta = s.payout - prev;
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-3 px-3 py-2 border-t border-border items-center"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={s.threshold}
                          onChange={(e) => updateSlab(i, { threshold: Number(e.target.value) })}
                          className="h-8 w-20"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
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
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {(unsorted || nonMono) && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <div>
                    {unsorted && <div>Thresholds must be strictly ascending.</div>}
                    {nonMono && <div>Payout decreases at some slab — usually a mistake.</div>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Rate per complied line (₹)</Label>
                  <Input
                    type="number"
                    value={cfg.perLine.ratePerLine}
                    onChange={(e) =>
                      onChange({ ...cfg, perLine: { ...cfg.perLine, ratePerLine: Number(e.target.value) } })
                    }
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Min lines to earn</Label>
                  <Input
                    type="number"
                    value={cfg.perLine.minLines}
                    onChange={(e) =>
                      onChange({ ...cfg, perLine: { ...cfg.perLine, minLines: Number(e.target.value) } })
                    }
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Max lines (cap)</Label>
                  <Input
                    type="number"
                    value={cfg.perLine.maxLines}
                    onChange={(e) =>
                      onChange({ ...cfg, perLine: { ...cfg.perLine, maxLines: Number(e.target.value) } })
                    }
                    className={`h-9 ${invalidLineRange ? "border-destructive" : ""}`}
                  />
                </div>
              </div>
              {invalidLineRange && (
                <p className="text-xs text-destructive">Max lines must be greater than min lines.</p>
              )}
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                Earn <span className="font-medium text-foreground">{fmt(cfg.perLine.minLines * cfg.perLine.ratePerLine)}</span> at {cfg.perLine.minLines} complied lines,
                capped at <span className="font-medium text-foreground">{fmt(perLineMax)}</span> at {cfg.perLine.maxLines} lines.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AiRecommendedOrderTemplateCard({ value, onChange }: Props) {
  const [cfg, setCfg] = useControlled<AiRecommendedOrderConfig>(value, onChange, DEFAULT_AI_RECO);
  const total = aiRecoMaxPayout(cfg);

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-muted/30">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">AI Recommended Order</h2>
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Sparkles size={10} /> AI Recommendations
            </Badge>
            <Badge variant="outline" className="text-[10px]">Monthly payout</Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Rewards reps for complying with the SFA one-click order — a Cross-sell SKU (new push) and a
            Recover SKU (regular upsell) recommended per outlet by the AI/ML engine.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max earning</div>
          <div className="text-lg font-semibold text-primary">{fmt(total)}</div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info size={12} className="mt-0.5 shrink-0" />
          Recommendations are served daily by the SFA AI/ML engine. A recommendation is "complied"
          based on the chosen compliance type — SKU only (recommended SKU billed) or SKU + Qty
          (recommended SKU billed at recommended qty or higher). Any SKU within the same CRS / group
          code also counts.
        </p>

        <SubMetricEditor
          title="Cross-sell SKU"
          subtitle="New SKU being pushed at the outlet."
          cfg={cfg.crossSell}
          onChange={(crossSell) => setCfg((c) => ({ ...c, crossSell }))}
        />
        <SubMetricEditor
          title="Recover SKU"
          subtitle="Regularly sold SKU we are upselling back."
          cfg={cfg.recover}
          onChange={(recover) => setCfg((c) => ({ ...c, recover }))}
        />

        <KeyNotesSection
          index={3}
          notes={cfg.keyNotes}
          onChange={(keyNotes) => setCfg((c) => ({ ...c, keyNotes }))}
        />
      </div>
    </Card>
  );
}
