import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Plus,
  X,
  TrendingUp,
  Check,
  XCircle,
  TrendingDown,
  Minus,
  ArrowUpRight,
  Lock,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClonedProgram, AIChange } from "./cloneUtils";
import { mockProducts, kpiRequiresSkus, getKpiSkus } from "@/data/mockData";
import type { ProgramKPI } from "@/data/mockData";
import { KPIBrowserDialog } from "./KPIBrowserDialog";
import { ProductBrowserDialog } from "./ProductBrowserDialog";
import { KpiPayoutMatrix } from "@/components/programs/KpiPayoutMatrix";

type Tab = "suggestions" | "kpis" | "products" | "payout";

interface CloneResultViewProps {
  clonedProgram: ClonedProgram;
  onConfirm: () => void;
  compact?: boolean;
  showToggles?: boolean;
  /** Controlled accepted state for parent-orchestrated views (multi-clone). */
  acceptedChanges?: boolean[];
  onAcceptedChange?: (accepted: boolean[]) => void;
}

/** Map raw AI change type → human action verb + visual treatment. */
function getActionMeta(change: AIChange) {
  if (change.type === "dropped") {
    return {
      verb: "Remove",
      Icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/10",
      ring: "ring-destructive/20",
    };
  }
  if (change.type === "kept") {
    return {
      verb: "Stretch",
      Icon: ArrowUpRight,
      color: "text-[hsl(var(--success))]",
      bg: "bg-[hsl(var(--success))]/10",
      ring: "ring-[hsl(var(--success))]/20",
    };
  }
  // improved
  if (change.field.toLowerCase().includes("payout")) {
    return {
      verb: "Adjust payout",
      Icon: TrendingUp,
      color: "text-[hsl(var(--warning))]",
      bg: "bg-[hsl(var(--warning))]/10",
      ring: "ring-[hsl(var(--warning))]/20",
    };
  }
  if (change.field.toLowerCase().includes("budget")) {
    return {
      verb: "Rebalance",
      Icon: Minus,
      color: "text-primary",
      bg: "bg-primary/10",
      ring: "ring-primary/20",
    };
  }
  return {
    verb: "Refine",
    Icon: TrendingUp,
    color: "text-[hsl(var(--warning))]",
    bg: "bg-[hsl(var(--warning))]/10",
    ring: "ring-[hsl(var(--warning))]/20",
  };
}

export function CloneResultView({
  clonedProgram,
  onConfirm,
  compact,
  showToggles,
  acceptedChanges: controlledAccepted,
  onAcceptedChange,
}: CloneResultViewProps) {
  const { original, changes, improvedKpis, improvedPayoutTiers } = clonedProgram;

  const [tab, setTab] = useState<Tab>("suggestions");
  const [internalAccepted, setInternalAccepted] = useState<boolean[]>(() =>
    changes.map(() => true),
  );
  const acceptedChanges = controlledAccepted ?? internalAccepted;

  const setAccepted = (next: boolean[]) => {
    if (onAcceptedChange) onAcceptedChange(next);
    else setInternalAccepted(next);
  };

  // If the changes list size shifts (different program), reset internal state.
  useEffect(() => {
    if (!controlledAccepted) {
      setInternalAccepted(changes.map(() => true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedProgram]);

  const [kpis, setKpis] = useState<ProgramKPI[]>(improvedKpis);
  // Per-KPI SKU map. Seeded from each KPI's `skus` (or default split of program SKUs).
  const [skusByKpi, setSkusByKpi] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    improvedKpis.forEach((k) => {
      if (kpiRequiresSkus(k.name)) map[k.name] = getKpiSkus(k, original);
    });
    return map;
  });
  const allSkus = useMemo(() => {
    const set = new Set<string>();
    Object.values(skusByKpi).forEach((arr) => arr.forEach((s) => set.add(s)));
    return [...set];
  }, [skusByKpi]);
  const [kpiBrowserOpen, setKpiBrowserOpen] = useState(false);
  const [productBrowserForKpi, setProductBrowserForKpi] = useState<string | null>(null);
  const [lockedWeights, setLockedWeights] = useState<Set<string>>(new Set());

  const toggleLock = (name: string) =>
    setLockedWeights(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  /**
   * Edit one KPI's weight; redistribute the delta across the other unlocked
   * KPIs so total stays at 100%. Locked KPIs are untouched.
   */
  const updateKpiWeight = (name: string, rawNext: number) => {
    setKpis(prev => {
      const target = prev.find(k => k.name === name);
      if (!target) return prev;
      const others = prev.filter(k => k.name !== name);
      const unlockedOthers = others.filter(k => !lockedWeights.has(k.name));
      const lockedTotal = others
        .filter(k => lockedWeights.has(k.name))
        .reduce((s, k) => s + k.weight, 0);
      const maxAllowed = Math.max(0, 100 - lockedTotal);
      const clamped = Math.max(0, Math.min(maxAllowed, Math.round(rawNext)));
      const remainder = maxAllowed - clamped;
      const unlockedSum = unlockedOthers.reduce((s, k) => s + k.weight, 0) || 1;
      let allocated = 0;
      const redistributed = unlockedOthers.map((k, i) => {
        const w = i === unlockedOthers.length - 1
          ? Math.max(0, remainder - allocated)
          : Math.round((k.weight / unlockedSum) * remainder);
        if (i !== unlockedOthers.length - 1) allocated += w;
        return { name: k.name, weight: w };
      });
      const map = new Map(redistributed.map(r => [r.name, r.weight]));
      return prev.map(k =>
        k.name === name
          ? { ...k, weight: clamped }
          : map.has(k.name)
            ? { ...k, weight: map.get(k.name)! }
            : k,
      );
    });
  };

  const acceptedCount = acceptedChanges.filter(Boolean).length;
  const rejectedCount = acceptedChanges.length - acceptedCount;
  const projectedLift = 8 + acceptedCount * 4;

  const toggleChange = (idx: number, accept: boolean) => {
    setAccepted(acceptedChanges.map((v, i) => (i === idx ? accept : v)));
  };

  const acceptAll = () => setAccepted(acceptedChanges.map(() => true));
  const rejectAll = () => setAccepted(acceptedChanges.map(() => false));

  const removeKpi = (name: string) => {
    setKpis(prev => {
      const filtered = prev.filter(k => k.name !== name);
      if (filtered.length === 0) return filtered;
      const total = filtered.reduce((s, k) => s + k.weight, 0);
      return filtered.map(k => ({ ...k, weight: Math.round((k.weight / total) * 100) }));
    });
    setSkusByKpi(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const addKpiFromBrowser = (kpi: { name: string }) => {
    if (kpis.find(k => k.name === kpi.name)) return;
    const seededTiers = improvedPayoutTiers.map(t => ({
      label: t.label,
      minAttainment: t.minAttainment,
      maxAttainment: t.maxAttainment,
      payoutPerRep: Math.max(50, Math.round((t.payoutPerRep * 0.1) / 50) * 50),
    }));
    const newKpi: ProgramKPI = {
      name: kpi.name,
      target: "TBD",
      weight: 10,
      attainment: 0,
      payoutTiers: seededTiers,
    };
    setKpis(prev => {
      const all = [...prev, newKpi];
      const total = all.reduce((s, k) => s + k.weight, 0);
      return all.map(k => ({ ...k, weight: Math.round((k.weight / total) * 100) }));
    });
    if (kpiRequiresSkus(kpi.name)) {
      setSkusByKpi(prev => (prev[kpi.name] ? prev : { ...prev, [kpi.name]: [] }));
    }
  };

  const removeSkuFromKpi = (kpiName: string, sku: string) =>
    setSkusByKpi((prev) => ({
      ...prev,
      [kpiName]: (prev[kpiName] ?? []).filter((s) => s !== sku),
    }));
  const addSkuToKpi = (kpiName: string, sku: string) =>
    setSkusByKpi((prev) => {
      const list = prev[kpiName] ?? [];
      if (list.includes(sku)) return prev;
      return { ...prev, [kpiName]: [...list, sku] };
    });

  const tabs: { id: Tab; label: string; count: number; needsAttention?: boolean }[] = [
    {
      id: "suggestions",
      label: "AI Suggestions",
      count: changes.length,
      needsAttention: showToggles && rejectedCount === 0 && changes.length > 0,
    },
    { id: "kpis", label: "KPI Mix", count: kpis.length },
    { id: "products", label: "Products", count: allSkus.length },
    { id: "payout", label: "Payout Matrix", count: improvedPayoutTiers.length },
  ];

  return (
    <div className="flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Hero header */}
      <div className={cn("flex items-start gap-4", compact ? "px-5 pt-5 pb-4" : "px-6 pt-5 pb-5")}>
        <div className="w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center text-2xl shrink-0">
          {original.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className={cn(
                "font-semibold text-foreground truncate",
                compact ? "text-sm" : "text-base",
              )}
            >
              {original.name}
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              <Sparkles size={9} /> AI Improved
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {original.region} · {original.channel} · {original.userType}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1 text-[hsl(var(--success))]">
            <TrendingUp size={13} />
            <span className="text-lg font-bold leading-none tabular-nums">+{projectedLift}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">projected lift</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-3 text-[11px] bg-muted/40 border border-border/60 rounded-lg px-3 py-2">
          <span className="font-semibold text-foreground">{changes.length} suggestions</span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1 text-[hsl(var(--success))] font-medium">
            <Check size={11} /> {acceptedCount} accepted
          </span>
          {rejectedCount > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                <XCircle size={11} /> {rejectedCount} rejected
              </span>
            </>
          )}
          <span className="ml-auto text-muted-foreground">
            Toggle each suggestion to fine-tune the clone
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className={cn("flex items-center gap-1 border-b border-border", compact ? "px-3" : "px-4")}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-3 py-2.5 text-xs font-medium transition-colors",
              tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-1.5">
              {t.label}
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums",
                  tab === t.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {t.count}
              </span>
              {t.needsAttention && (
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--warning))]" />
              )}
            </span>
            {tab === t.id && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={cn(compact ? "px-5 py-5" : "px-6 py-5")}>
        {tab === "suggestions" && (
          <div className="space-y-3">
            {changes.length > 0 && showToggles && (
              <div className="flex items-center justify-end gap-1 -mt-1">
                <button
                  onClick={acceptAll}
                  className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/60 transition-colors"
                >
                  Accept all
                </button>
                <span className="text-border">·</span>
                <button
                  onClick={rejectAll}
                  className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/60 transition-colors"
                >
                  Reject all
                </button>
              </div>
            )}
            {changes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No changes suggested.
              </p>
            )}
            <div className="space-y-2">
              {changes.map((change, i) => {
                const meta = getActionMeta(change);
                const accepted = acceptedChanges[i];
                return (
                  <div
                    key={i}
                    className={cn(
                      "border border-border rounded-lg p-3 transition-all",
                      accepted ? "bg-card" : "bg-muted/20 opacity-60",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center shrink-0 ring-1",
                          meta.bg,
                          meta.ring,
                        )}
                      >
                        <meta.Icon size={14} className={meta.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={cn("text-[10px] uppercase tracking-wider font-bold", meta.color)}>
                            {meta.verb}
                          </span>
                          <span className="text-xs font-semibold text-foreground">{change.field}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground line-through decoration-muted-foreground/60">
                            {change.oldValue}
                          </span>
                          <ArrowRight size={10} className="text-muted-foreground shrink-0" />
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded font-semibold",
                              meta.bg,
                              meta.color,
                            )}
                          >
                            {change.newValue}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-2">
                          {change.reason}
                        </p>
                      </div>
                      {showToggles && (
                        <div className="flex items-center gap-px shrink-0 bg-muted/50 rounded-md p-0.5">
                          <button
                            onClick={() => toggleChange(i, true)}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1",
                              accepted
                                ? "bg-[hsl(var(--success))] text-white shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            aria-label="Accept suggestion"
                          >
                            <Check size={10} /> Accept
                          </button>
                          <button
                            onClick={() => toggleChange(i, false)}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1",
                              !accepted
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            aria-label="Reject suggestion"
                          >
                            <X size={10} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "kpis" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Weighted KPI mix — <span className="text-primary font-medium">click any % to edit</span>, others auto-rebalance to 100%
              </p>
              <button
                onClick={() => setKpiBrowserOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
              >
                <Plus size={11} /> Browse KPIs
              </button>
            </div>
            <div className="space-y-1">
              {kpis.map(kpi => {
                const locked = lockedWeights.has(kpi.name);
                return (
                  <div
                    key={kpi.name}
                    className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        kpi.attainment >= 80
                          ? "bg-[hsl(var(--success))]"
                          : kpi.attainment >= 60
                            ? "bg-[hsl(var(--warning))]"
                            : "bg-destructive",
                      )}
                    />
                    <span className="text-xs text-foreground flex-1 truncate">{kpi.name}</span>
                    <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${kpi.weight}%` }}
                      />
                    </div>
                    {/* Editable weight — styled to look like an input, not text */}
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={kpi.weight}
                        onChange={e => updateKpiWeight(kpi.name, parseInt(e.target.value) || 0)}
                        disabled={locked}
                        className={cn(
                          "w-12 h-7 text-xs font-bold tabular-nums text-right pr-4 pl-1.5 rounded-md border bg-background transition-colors",
                          "border-border hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30",
                          locked && "opacity-60 cursor-not-allowed bg-muted",
                          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        )}
                      />
                      <span className="absolute right-1.5 text-[10px] text-muted-foreground pointer-events-none">%</span>
                    </div>
                    <button
                      onClick={() => toggleLock(kpi.name)}
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors",
                        locked
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted",
                      )}
                      aria-label={locked ? `Unlock ${kpi.name} weight` : `Lock ${kpi.name} weight`}
                      title={locked ? "Weight locked — won't auto-rebalance" : "Lock weight"}
                    >
                      <Lock size={11} />
                    </button>
                    <button
                      onClick={() => removeKpi(kpi.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove ${kpi.name}`}
                    >
                      <X size={12} className="text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "products" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {allSkus.length} SKUs in scope · grouped by KPI
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Each KPI tracks its own SKU list. Behavior KPIs (visit, compliance) carry no SKUs.
                </p>
              </div>
            </div>

            {kpis.filter(k => kpiRequiresSkus(k.name)).length === 0 && (
              <div className="text-center py-8 border border-dashed border-border rounded-lg">
                <p className="text-xs text-muted-foreground">
                  None of the selected KPIs require SKU scoping.
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Add a Volume / Sales / Range / Display KPI to attach products.
                </p>
              </div>
            )}

            {kpis
              .filter(k => kpiRequiresSkus(k.name))
              .map(kpi => {
                const list = skusByKpi[kpi.name] ?? [];
                return (
                  <div key={kpi.name} className="border border-border rounded-lg bg-card">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span className="text-xs font-semibold text-foreground truncate">{kpi.name}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          · {list.length} SKU{list.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <button
                        onClick={() => setProductBrowserForKpi(kpi.name)}
                        className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline shrink-0"
                      >
                        <Plus size={11} /> Add SKUs
                      </button>
                    </div>
                    {list.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-[11px] text-muted-foreground">
                          No SKUs scoped for this KPI yet.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                        {list.map(sku => {
                          const prod = mockProducts.find(p => p.sku === sku);
                          if (!prod) {
                            return (
                              <div
                                key={sku}
                                className="group relative flex items-center gap-3 p-2.5 rounded-md border border-dashed border-border bg-muted/20"
                              >
                                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                                  <span className="text-lg">📦</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-mono font-semibold text-foreground">{sku}</p>
                                  <p className="text-[10px] text-muted-foreground italic">Unavailable</p>
                                </div>
                                <button
                                  onClick={() => removeSkuFromKpi(kpi.name, sku)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                                  aria-label={`Remove ${sku}`}
                                >
                                  <X size={12} className="text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={sku}
                              className="group relative flex items-center gap-2.5 p-2.5 rounded-md border border-border bg-card hover:border-primary/40 transition-all"
                            >
                              <div className="w-9 h-9 rounded bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-border">
                                <span className="text-xl leading-none">{prod.imageEmoji}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">
                                    {prod.sku}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground">·</span>
                                  <span className="text-[9px] text-muted-foreground tabular-nums">₹{prod.price}</span>
                                </div>
                                <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                                  {prod.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {prod.brand} · {prod.packSize} · {prod.category}
                                </p>
                              </div>
                              <button
                                onClick={() => removeSkuFromKpi(kpi.name, sku)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 shrink-0"
                                aria-label={`Remove ${prod.name}`}
                              >
                                <X size={12} className="text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {tab === "payout" && (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground">
                Payout per rep at each KPI × tier intersection. Each KPI has its own attainment-based schedule — totals roll up to the program tier.
              </p>
            </div>
            <KpiPayoutMatrix kpis={kpis} compact showTotals />
          </div>
        )}
      </div>

      {!showToggles && (
        <div className={cn("border-t border-border", compact ? "px-5 py-4" : "px-6 py-5")}>
          <Button onClick={onConfirm} className="w-full gap-2 text-sm">
            <Sparkles size={14} /> Use This Improved Program
          </Button>
        </div>
      )}

      {/* Browser Dialogs */}
      <KPIBrowserDialog
        open={kpiBrowserOpen}
        onOpenChange={setKpiBrowserOpen}
        existingKpiNames={new Set(kpis.map(k => k.name))}
        onAddKpi={addKpiFromBrowser}
        onRemoveKpi={removeKpi}
      />
      <ProductBrowserDialog
        open={productBrowserForKpi !== null}
        onOpenChange={open => !open && setProductBrowserForKpi(null)}
        existingSkus={new Set(productBrowserForKpi ? skusByKpi[productBrowserForKpi] ?? [] : [])}
        onAddSku={sku => productBrowserForKpi && addSkuToKpi(productBrowserForKpi, sku)}
        forKpiName={productBrowserForKpi ?? undefined}
      />
    </div>
  );
}
