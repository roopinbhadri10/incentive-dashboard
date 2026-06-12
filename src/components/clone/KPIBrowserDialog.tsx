import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search,
  Sparkles,
  Check,
  Plus,
  Wand2,
  Loader2,
  ArrowLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockKPIs } from "@/data/mockData";
import type { KPI } from "@/data/mockData";

/**
 * KPI Library — compact, scannable picker.
 *
 * Design goals (vs. previous verbose card grid):
 *  • One row per KPI. Name + a single signal pill, no paragraph.
 *  • Category lives in a left rail (filter), not on every card.
 *  • Hover any row to see full description + AI rationale in a tooltip.
 *  • Quick "+" affordance so multiple KPIs can be added in one session.
 */

interface KPIBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingKpiNames: Set<string>;
  onAddKpi: (kpi: KPI) => void;
  onRemoveKpi?: (name: string) => void;
}

const categories = [
  { key: "all", label: "All KPIs" },
  { key: "sales", label: "Sales" },
  { key: "distribution", label: "Distribution" },
  { key: "visibility", label: "Visibility" },
  { key: "compliance", label: "Compliance" },
] as const;

const categoryDot: Record<string, string> = {
  sales: "bg-[hsl(217_91%_60%)]",
  distribution: "bg-[hsl(160_84%_39%)]",
  visibility: "bg-[hsl(38_92%_50%)]",
  compliance: "bg-[hsl(271_91%_65%)]",
  custom: "bg-[hsl(330_81%_60%)]",
};

type Signal = { kind: "good" | "ok" | "warn"; label: string; sample?: number };

/**
 * Deterministic pseudo-random sample size from the KPI name so the same KPI
 * always shows the same n. Range biased toward 80-450 to look realistic.
 */
function mockSampleSize(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 80 + (h % 370);
}

/** Round to nearest 0.5 — honest precision for a modeled estimate. */
function roundHalf(n: number): string {
  const r = Math.round(n * 2) / 2;
  return r % 1 === 0 ? `${r}` : r.toFixed(1);
}

/** Bucket an attainment % into a directional range, e.g. 67 → "60-70%". */
function attBucket(n: number): string {
  const lo = Math.floor(n / 10) * 10;
  return `${lo}-${lo + 10}%`;
}

/**
 * Distil the long AI reason string into a single short pill.
 * Priority: explicit ROI multiple > attainment % > recommendation tone.
 *
 * Numbers are intentionally rounded (not "3.2x" but "~3x") because the
 * underlying signal is a modeled estimate, not a measured fact. Spurious
 * precision is the #1 way AI insights mislead operators.
 */
function extractSignal(reason?: string, seed?: string): Signal | null {
  if (!reason) return null;
  const sample = seed ? mockSampleSize(seed) : undefined;

  const roi = reason.match(/(\d+(?:\.\d+)?)x\s*ROI/i);
  if (roi) {
    const n = parseFloat(roi[1]);
    return {
      kind: n >= 2 ? "good" : n >= 1.2 ? "ok" : "warn",
      label: `~${roundHalf(n)}x ROI`,
      sample,
    };
  }

  const att = reason.match(/(\d+)%\s*(?:attainment|avg|compliance)/i);
  if (att) {
    const n = parseInt(att[1]);
    return {
      kind: n >= 70 ? "good" : n >= 50 ? "ok" : "warn",
      label: `${attBucket(n)} att`,
      sample,
    };
  }

  const lift = reason.match(/(\d+)%\s*(?:uplift|lift|improvement|reduction|gain)/i);
  if (lift) {
    const n = parseInt(lift[1]);
    const lo = Math.max(0, Math.round((n - 5) / 5) * 5);
    const hi = Math.round((n + 5) / 5) * 5;
    return { kind: "good", label: `+${lo}-${hi}% lift (est.)`, sample };
  }

  const r = reason.toLowerCase();
  if (r.includes("not recommended") || r.includes("low priority") || r.includes("caution") || r.includes("below"))
    return { kind: "warn", label: "Caution", sample };
  if (r.includes("recommended") || r.includes("verified") || r.includes("high roi"))
    return { kind: "good", label: "Recommended", sample };

  return null;
}

const signalStyles: Record<Signal["kind"], string> = {
  good: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20",
  ok: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  warn: "bg-destructive/10 text-destructive border-destructive/20",
};

function generateKpiFromDescription(description: string): KPI {
  const lower = description.toLowerCase();
  let category: KPI["category"] = "custom";
  if (/revenue|sales|volume|order|sell/.test(lower)) category = "sales";
  else if (/outlet|coverage|distribution|route/.test(lower)) category = "distribution";
  else if (/display|shelf|visibility|planogram|cooler/.test(lower)) category = "visibility";
  else if (/compliance|adherence|audit|freshness|price/.test(lower)) category = "compliance";

  const words = description.split(/\s+/).slice(0, 5);
  const name = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return {
    id: `custom-${Date.now()}`,
    name: name.length > 30 ? name.slice(0, 30) + "…" : name,
    description: description.length > 100 ? description.slice(0, 100) + "…" : description,
    category,
    isAISuggested: false,
    aiReason: "Custom KPI · No historical data yet · Monitor for 1 quarter",
  };
}

type View = "browse" | "build";

export function KPIBrowserDialog({ open, onOpenChange, existingKpiNames, onAddKpi, onRemoveKpi }: KPIBrowserDialogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [view, setView] = useState<View>("browse");
  const [buildInput, setBuildInput] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [builtKpi, setBuiltKpi] = useState<KPI | null>(null);
  // Track order KPIs were added in this session so the newest pill appears first.
  const [sessionOrder, setSessionOrder] = useState<string[]>([]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: mockKPIs.length };
    for (const k of mockKPIs) c[k.category] = (c[k.category] ?? 0) + 1;
    return c;
  }, []);

  const filtered = useMemo(() => {
    let items = mockKPIs;
    if (category !== "all") items = items.filter(k => k.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        k => k.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q),
      );
    }
    return [...items].sort((a, b) => {
      if (a.isAISuggested && !b.isAISuggested) return -1;
      if (!a.isAISuggested && b.isAISuggested) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [search, category]);

  const handleBuild = async () => {
    if (!buildInput.trim()) return;
    setIsBuilding(true);
    setBuiltKpi(null);
    await new Promise(r => setTimeout(r, 1400));
    setBuiltKpi(generateKpiFromDescription(buildInput.trim()));
    setIsBuilding(false);
  };

  const handleAddBuiltKpi = () => {
    if (!builtKpi) return;
    onAddKpi(builtKpi);
    setSessionOrder(prev => [builtKpi.name, ...prev.filter(n => n !== builtKpi.name)]);
    setBuildInput("");
    setBuiltKpi(null);
    setView("browse");
  };

  const resetBuild = () => {
    setView("browse");
    setBuildInput("");
    setBuiltKpi(null);
    setIsBuilding(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) resetBuild(); onOpenChange(o); }}>
      <DialogContent className="max-w-[820px] w-[92vw] h-[78vh] max-h-[680px] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header — slim */}
        <DialogHeader className="px-5 pt-4 pb-3 shrink-0 border-b border-border space-y-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <DialogTitle className="text-sm font-semibold">
                {view === "browse" ? "KPI Library" : "Build a Custom KPI"}
              </DialogTitle>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {view === "browse"
                  ? `${counts.all} KPIs available`
                  : "Describe what to measure — AI drafts the KPI"}
              </span>
            </div>
            {view === "browse" ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[11px] h-7"
                onClick={() => setView("build")}
              >
                <Wand2 size={11} /> Build with AI
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-[11px] h-7 text-muted-foreground"
                onClick={resetBuild}
              >
                <ArrowLeft size={11} /> Library
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Selected KPIs strip — newest pill first, click X to remove */}
        {existingKpiNames.size > 0 && (
          <div className="px-4 py-2 border-b border-border bg-primary/[0.03] shrink-0">
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mt-1">
                Added <span className="tabular-nums">({existingKpiNames.size})</span>
              </span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {[
                  ...sessionOrder.filter(n => existingKpiNames.has(n)),
                  ...[...existingKpiNames].filter(n => !sessionOrder.includes(n)),
                ].map(name => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-medium animate-fade-in shadow-sm"
                  >
                    {name}
                    {onRemoveKpi && (
                      <button
                        onClick={() => {
                          onRemoveKpi(name);
                          setSessionOrder(prev => prev.filter(n => n !== name));
                        }}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/40 transition-colors"
                        aria-label={`Remove ${name}`}
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "browse" ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Left rail: categories */}
            <aside className="w-44 border-r border-border bg-muted/20 shrink-0 overflow-y-auto">
              <ul className="py-2">
                {categories.map(c => {
                  const count = counts[c.key] ?? 0;
                  const active = category === c.key;
                  return (
                    <li key={c.key}>
                      <button
                        onClick={() => setCategory(c.key)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-[12px] transition-colors border-l-2",
                          active
                            ? "bg-primary/5 border-l-primary text-foreground font-semibold"
                            : "border-l-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {c.key !== "all" && (
                            <span className={cn("w-1.5 h-1.5 rounded-full", categoryDot[c.key])} />
                          )}
                          {c.label}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/70">
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Right: search + dense list */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Search bar */}
              <div className="px-4 py-2.5 border-b border-border shrink-0">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search KPIs by name or description…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Dense list */}
              <ScrollArea className="flex-1">
                <TooltipProvider delayDuration={300}>
                  <ul className="divide-y divide-border/60">
                    {filtered.map(kpi => {
                      const added = existingKpiNames.has(kpi.name);
                      const signal = extractSignal(kpi.aiReason, kpi.id);
                      const lowConfidence = signal?.sample !== undefined && signal.sample < 150;
                      return (
                        <li key={kpi.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                disabled={added}
                                onClick={() => {
                                  onAddKpi(kpi);
                                  setSessionOrder(prev => [kpi.name, ...prev.filter(n => n !== kpi.name)]);
                                }}
                                className={cn(
                                  "w-full px-4 py-2 flex items-center gap-3 text-left transition-colors group",
                                  added
                                    ? "bg-primary/[0.04] cursor-default"
                                    : "hover:bg-muted/40 cursor-pointer",
                                )}
                              >
                                {/* Category dot */}
                                <span
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                    categoryDot[kpi.category],
                                  )}
                                  aria-label={kpi.category}
                                />

                                {/* Name */}
                                <span
                                  className={cn(
                                    "text-[13px] font-medium truncate",
                                    added ? "text-muted-foreground line-through" : "text-foreground",
                                  )}
                                >
                                  {kpi.name}
                                </span>

                                {/* AI pick badge — minimal */}
                                {kpi.isAISuggested && !added && (
                                  <Sparkles
                                    size={11}
                                    className="text-primary shrink-0"
                                    aria-label="AI suggested"
                                  />
                                )}

                                {/* Spacer */}
                                <span className="flex-1" />

                                {/* Signal pill — rounded estimate + sample size for honesty */}
                                {signal && !added && (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border tabular-nums shrink-0",
                                      signalStyles[signal.kind],
                                    )}
                                  >
                                    {signal.label}
                                    {signal.sample !== undefined && (
                                      <span className="opacity-70 font-normal">· n={signal.sample}</span>
                                    )}
                                  </span>
                                )}
                                {lowConfidence && !added && (
                                  <span
                                    className="text-[10px] font-medium text-muted-foreground shrink-0"
                                    title="Low sample size — treat as directional"
                                  >
                                    ⚠ low conf.
                                  </span>
                                )}

                                {/* Add / Added */}
                                {added ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary shrink-0">
                                    <Check size={11} /> Added
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-transparent group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground transition-colors shrink-0">
                                    <Plus size={13} />
                                  </span>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="end" sideOffset={6} collisionPadding={12} className="max-w-[320px] z-[100]">
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold">{kpi.name}</p>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                  {kpi.description}
                                </p>
                                {kpi.aiReason && (
                                  <p className="text-[10px] leading-snug pt-1 border-t border-border/60">
                                    <span className="text-primary font-medium">AI insight: </span>
                                    {kpi.aiReason}
                                  </p>
                                )}
                                <p className="text-[9px] leading-snug pt-1 border-t border-border/40 text-muted-foreground italic">
                                  Estimates based on historical patterns. Validate before applying to new regions or quarters.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </li>
                      );
                    })}
                    {filtered.length === 0 && (
                      <li className="px-4 py-12 text-center">
                        <p className="text-xs text-muted-foreground">
                          No KPIs match "{search}"
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-[11px] h-auto p-0 mt-1.5"
                          onClick={() => {
                            setBuildInput(search);
                            setView("build");
                          }}
                        >
                          Build "{search}" with AI →
                        </Button>
                      </li>
                    )}
                  </ul>
                </TooltipProvider>
              </ScrollArea>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-border bg-muted/20 shrink-0">
                <p className="text-[10px] text-muted-foreground">
                  Hover a KPI for details · Click to add · {filtered.length} shown
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Build Your Own KPI */
          <div className="flex-1 flex flex-col px-5 py-4 overflow-y-auto">
            <div className="space-y-3 flex-1">
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1.5 block">
                  Describe your KPI in plain English
                </label>
                <Textarea
                  placeholder="e.g. Track the percentage of outlets where our new mango drink is available within 30 days of launch…"
                  value={buildInput}
                  onChange={e => setBuildInput(e.target.value)}
                  className="min-h-[90px] text-xs resize-none"
                  disabled={isBuilding}
                />
              </div>

              <Button
                onClick={handleBuild}
                disabled={!buildInput.trim() || isBuilding}
                size="sm"
                className="gap-1.5 text-xs h-8"
              >
                {isBuilding ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Building…
                  </>
                ) : (
                  <>
                    <Wand2 size={12} /> Build KPI
                  </>
                )}
              </Button>

              {isBuilding && (
                <div className="rounded-md border border-primary/20 bg-primary/[0.03] p-4 flex flex-col items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    AI is drafting your KPI…
                  </p>
                </div>
              )}

              {builtKpi && !isBuilding && (
                <div className="rounded-md border border-primary/30 bg-primary/[0.03] p-4 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-primary" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      AI-Generated KPI
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("w-2 h-2 rounded-full", categoryDot[builtKpi.category])}
                    />
                    <p className="text-sm font-semibold text-foreground">{builtKpi.name}</p>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      · {builtKpi.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {builtKpi.description}
                  </p>
                  {builtKpi.aiReason && (
                    <p className="text-[10px] text-[hsl(var(--warning))] font-medium border-t border-border/60 pt-2">
                      {builtKpi.aiReason}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="gap-1 text-[11px] h-7" onClick={handleAddBuiltKpi}>
                      <Check size={11} /> Add KPI
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] h-7"
                      onClick={() => {
                        setBuiltKpi(null);
                        setBuildInput("");
                      }}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {!builtKpi && !isBuilding && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Try an example
                </p>
                <div className="space-y-1">
                  {[
                    "Track outlets billing at least 3 SKUs per visit",
                    "Repeat purchase rate within 14 days for new products",
                    "Coolers with 100% brand purity during summer",
                  ].map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setBuildInput(ex)}
                      className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
