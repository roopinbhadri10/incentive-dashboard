import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { payoutModes } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Plus, Sparkles, Trash2, Copy } from "lucide-react";

interface KpiTier {
  label: string;
  min: number;
  max: number;
  amount: number;
}

interface KpiRow {
  id: string;
  name: string;
  weight: number;
  tiers: KpiTier[];
}

const defaultTiers = (): KpiTier[] => [
  { label: "Tier 1", min: 80, max: 100, amount: 2500 },
  { label: "Tier 2", min: 100, max: 120, amount: 4000 },
  { label: "Tier 3", min: 120, max: 150, amount: 6000 },
];

const initialKpis: KpiRow[] = [
  { id: "k1", name: "Revenue Target", weight: 50, tiers: defaultTiers() },
  {
    id: "k2",
    name: "Numeric Distribution",
    weight: 50,
    tiers: [
      { label: "Tier 1", min: 70, max: 85, amount: 1500 },
      { label: "Tier 2", min: 85, max: 100, amount: 3000 },
    ],
  },
];

export function PayoutStep() {
  const [selectedModes, setSelectedModes] = useState<string[]>(["cash"]);
  const [totalBudget, setTotalBudget] = useState("500000");
  const [kpis, setKpis] = useState<KpiRow[]>(initialKpis);

  const toggleMode = (id: string) => {
    setSelectedModes(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id],
    );
  };

  const updateKpi = (id: string, patch: Partial<KpiRow>) =>
    setKpis(kpis.map(k => (k.id === id ? { ...k, ...patch } : k)));

  const updateTier = (kpiId: string, tIdx: number, patch: Partial<KpiTier>) =>
    setKpis(
      kpis.map(k =>
        k.id === kpiId
          ? { ...k, tiers: k.tiers.map((t, i) => (i === tIdx ? { ...t, ...patch } : t)) }
          : k,
      ),
    );

  const addTier = (kpiId: string) =>
    setKpis(
      kpis.map(k => {
        if (k.id !== kpiId) return k;
        const last = k.tiers[k.tiers.length - 1];
        return {
          ...k,
          tiers: [
            ...k.tiers,
            {
              label: `Tier ${k.tiers.length + 1}`,
              min: last ? last.max : 0,
              max: last ? last.max + 20 : 100,
              amount: last ? last.amount + 1500 : 1000,
            },
          ],
        };
      }),
    );

  const removeTier = (kpiId: string, tIdx: number) =>
    setKpis(
      kpis.map(k =>
        k.id === kpiId && k.tiers.length > 1
          ? { ...k, tiers: k.tiers.filter((_, i) => i !== tIdx) }
          : k,
      ),
    );

  const copyTiersToAll = (kpiId: string) => {
    const source = kpis.find(k => k.id === kpiId);
    if (!source) return;
    setKpis(
      kpis.map(k =>
        k.id === kpiId ? k : { ...k, tiers: source.tiers.map(t => ({ ...t })) },
      ),
    );
  };

  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
  const maxBudgetPerRep = useMemo(
    () => kpis.reduce((s, k) => s + Math.max(...k.tiers.map(t => t.amount), 0), 0),
    [kpis],
  );

  return (
    <div className="animate-fade-in space-y-4">
      {/* AI Suggestion */}
      <div className="gradient-banner rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Sparkles size={18} className="text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-foreground">Payout Recommendation</p>
            <p className="text-xs text-primary-foreground/80">
              Each KPI defines its own tiers, attainment bands, and payout amounts — so a Volume KPI can pay differently than a Compliance KPI.
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" className="text-xs shrink-0">
          Optimize
        </Button>
      </div>

      {/* Total Budget */}
      <Card className="p-4">
        <label className="text-sm font-medium mb-2 block">Total Budget</label>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg font-bold">₹</span>
          <Input
            value={totalBudget}
            onChange={e => setTotalBudget(e.target.value)}
            className="text-lg font-semibold max-w-xs"
          />
          <Badge variant="secondary" className="text-xs">
            ≈ ₹{(parseInt(totalBudget || "0") / 234).toFixed(0)} per participant
          </Badge>
          <Badge variant="outline" className="text-xs">
            Max ₹{maxBudgetPerRep.toLocaleString()} per rep at top tier
          </Badge>
        </div>
      </Card>

      {/* Payout Mode */}
      <div>
        <label className="text-sm font-medium mb-2 block">Payout Mode</label>
        <div className="flex gap-3 flex-wrap">
          {payoutModes.map(mode => (
            <Card
              key={mode.id}
              className={cn(
                "px-4 py-3 cursor-pointer border-2 transition-all flex items-center gap-2",
                selectedModes.includes(mode.id)
                  ? "border-primary bg-sidebar-accent"
                  : "border-transparent hover:border-border",
              )}
              onClick={() => toggleMode(mode.id)}
            >
              <span className="text-lg">{mode.icon}</span>
              <span className="text-sm font-medium">{mode.name}</span>
            </Card>
          ))}
        </div>
      </div>

      {selectedModes.length > 1 && (
        <Card className="p-4">
          <label className="text-sm font-medium mb-3 block">Payout Split</label>
          {selectedModes.map(modeId => {
            const mode = payoutModes.find(m => m.id === modeId);
            return (
              <div key={modeId} className="flex items-center gap-3 mb-3">
                <span className="text-sm w-36">
                  {mode?.icon} {mode?.name}
                </span>
                <Slider
                  defaultValue={[Math.floor(100 / selectedModes.length)]}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-10">
                  {Math.floor(100 / selectedModes.length)}%
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {/* Per-KPI tiers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="text-sm font-medium block">KPI Payout Schedules</label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Each KPI has its own tiers and payouts. Reps earn the sum across all KPIs they hit.
            </p>
          </div>
          {totalWeight !== 100 && (
            <Badge variant="destructive" className="text-[10px]">
              Weights sum to {totalWeight}% — should be 100%
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          {kpis.map(kpi => {
            const kpiMax = Math.max(...kpi.tiers.map(t => t.amount), 0);
            return (
              <Card key={kpi.id} className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1 h-8 rounded-full bg-primary/70 shrink-0" aria-hidden />
                    <p className="font-semibold text-sm text-foreground truncate">{kpi.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      Top payout ₹{kpiMax.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-muted-foreground">Weight</label>
                    <Input
                      type="number"
                      value={kpi.weight}
                      onChange={e => updateKpi(kpi.id, { weight: parseInt(e.target.value) || 0 })}
                      className="w-16 h-7 text-xs text-right"
                    />
                    <span className="text-muted-foreground text-[11px]">%</span>
                    {kpis.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[11px] gap-1 h-7"
                        onClick={() => copyTiersToAll(kpi.id)}
                        title="Copy these tiers to all other KPIs"
                      >
                        <Copy size={12} /> Copy to all
                      </Button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-3 py-2">
                          Tier
                        </th>
                        <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-3 py-2">
                          Attainment %
                        </th>
                        <th className="text-right text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-3 py-2">
                          Payout per rep
                        </th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {kpi.tiers.map((tier, ti) => (
                        <tr key={ti} className="border-b border-border/50 last:border-b-0">
                          <td className="px-3 py-2">
                            <Input
                              value={tier.label}
                              onChange={e => updateTier(kpi.id, ti, { label: e.target.value })}
                              className="h-7 text-xs w-24"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={tier.min}
                                onChange={e =>
                                  updateTier(kpi.id, ti, { min: parseInt(e.target.value) || 0 })
                                }
                                className="w-16 h-7 text-xs"
                              />
                              <span>–</span>
                              <Input
                                type="number"
                                value={tier.max}
                                onChange={e =>
                                  updateTier(kpi.id, ti, { max: parseInt(e.target.value) || 0 })
                                }
                                className="w-16 h-7 text-xs"
                              />
                              <span className="text-muted-foreground">%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-[11px] text-muted-foreground">₹</span>
                              <Input
                                type="number"
                                value={tier.amount}
                                onChange={e =>
                                  updateTier(kpi.id, ti, {
                                    amount: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-24 h-7 text-xs text-right tabular-nums font-semibold"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            {kpi.tiers.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => removeTier(kpi.id, ti)}
                              >
                                <Trash2 size={12} className="text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1 mt-3"
                  onClick={() => addTier(kpi.id)}
                >
                  <Plus size={12} /> Add Tier
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
