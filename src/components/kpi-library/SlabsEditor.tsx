import { useMemo } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  computeSlabEarnings,
  validateNsv,
  type NsvSlab,
  type StepMode,
} from "./nsvTypes";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

interface Props {
  title: string;
  pctColumnLabel?: string;
  slabs: NsvSlab[];
  mode: StepMode;
  onSlabsChange: (slabs: NsvSlab[]) => void;
  onModeChange: (mode: StepMode) => void;
}

export function SlabsEditor({
  title,
  pctColumnLabel = "Achievement %",
  slabs,
  mode,
  onSlabsChange,
  onModeChange,
}: Props) {
  const earnings = useMemo(() => computeSlabEarnings(slabs, mode), [slabs, mode]);
  const validation = useMemo(
    () =>
      validateNsv({
        basis: "primary",
        slabs,
        cap: { enabled: false, pct: 0 },
        gatesEnabled: false,
        gates: [],
      }),
    [slabs],
  );

  const updateSlab = (idx: number, patch: Partial<NsvSlab>) =>
    onSlabsChange(slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const addSlab = () => {
    const last = slabs[slabs.length - 1];
    const nextPct = last ? last.pct + 5 : 100;
    const nextRate = last ? last.ratePerPct : 200;
    const nextPayout = (last?.entryPayout ?? 0) + 500;
    onSlabsChange([
      ...slabs,
      mode === "slab"
        ? { pct: nextPct, ratePerPct: 0, entryPayout: nextPayout }
        : { pct: nextPct, ratePerPct: nextRate },
    ]);
  };

  const removeSlab = (idx: number) => onSlabsChange(slabs.filter((_, i) => i !== idx));

  const isStepUp = mode === "stepup";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </Label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1 bg-muted/20">
            <Switch
              checked={isStepUp}
              onCheckedChange={(v) => onModeChange(v ? "stepup" : "slab")}
            />
            <span className="text-xs">
              <span className="font-medium">Step-up by 1%</span>
              <span className="text-muted-foreground ml-1">
                {isStepUp ? "(on)" : "(off — pure slab)"}
              </span>
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={addSlab} className="gap-1">
            <Plus size={14} /> Add slab
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {isStepUp
          ? "Payout grows linearly between slabs at ₹X per 1% achievement."
          : "Pure slab — payout jumps to the slab amount only when achievement reaches that slab. No payout for intermediate %."}
      </p>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1.2fr_1.2fr_auto] gap-3 px-4 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <div>{pctColumnLabel}</div>
          <div>{isStepUp ? "Rate (₹ per 1%)" : "Payout at this slab (₹)"}</div>
          <div>Earning for this band</div>
          <div className="w-8" />
        </div>
        {slabs.map((s, i) => {
          const band = earnings[i];
          const prevPct = i === 0 ? null : slabs[i - 1].pct;
          const isDup = validation.duplicateSlabPcts.includes(s.pct);
          return (
            <div
              key={i}
              className="grid grid-cols-[1fr_1.2fr_1.2fr_auto] gap-3 px-4 py-2 border-t border-border items-center"
            >
              <div className="flex items-center gap-2">
                <NumberInput
                  value={s.pct}
                  onValueChange={(n) => updateSlab(i, { pct: n })}
                  className={`h-8 w-24 ${isDup ? "border-destructive" : ""}`}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>

              {isStepUp ? (
                i === 0 ? (
                  <div className="text-xs text-muted-foreground italic">Entry slab</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">₹</span>
                    <NumberInput
                      value={s.ratePerPct}
                      onValueChange={(n) => updateSlab(i, { ratePerPct: n })}
                      className="h-8 w-28"
                    />
                    <span className="text-xs text-muted-foreground">/ 1%</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">₹</span>
                  <NumberInput
                    value={s.entryPayout ?? 0}
                    onValueChange={(n) => updateSlab(i, { entryPayout: n })}
                    className="h-8 w-28"
                  />
                </div>
              )}

              <div className="text-xs text-foreground">
                {isStepUp ? (
                  i === 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Starting earning</span>
                      <span className="text-xs text-muted-foreground">₹</span>
                      <NumberInput
                        value={s.entryPayout ?? 0}
                        onValueChange={(n) => updateSlab(i, { entryPayout: n })}
                        className="h-8 w-28"
                      />
                    </div>
                  ) : (
                    <span>
                      From {prevPct}% → {s.pct}% ·{" "}
                      <span className="font-medium">{fmt(band.delta)}</span>
                    </span>
                  )
                ) : (
                  <span>
                    At {s.pct}% achievement ·{" "}
                    <span className="font-medium">{fmt(band.cumulative)}</span>
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeSlab(i)}
                disabled={slabs.length <= 2}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          );
        })}
      </div>

      {(validation.duplicateSlabPcts.length > 0 || validation.unsortedSlabs) && (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            {validation.duplicateSlabPcts.length > 0 && (
              <div>
                Duplicate slab %: {validation.duplicateSlabPcts.join(", ")}. Each slab must be
                unique.
              </div>
            )}
            {validation.unsortedSlabs && <div>Slabs must be in ascending order.</div>}
          </div>
        </div>
      )}
    </section>
  );
}
