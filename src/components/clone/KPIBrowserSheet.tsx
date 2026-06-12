import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Sparkles, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockKPIs } from "@/data/mockData";
import type { KPI } from "@/data/mockData";

const categories = [
  { key: "all", label: "All" },
  { key: "sales", label: "Sales" },
  { key: "distribution", label: "Distribution" },
  { key: "visibility", label: "Visibility" },
  { key: "compliance", label: "Compliance" },
] as const;

interface KPIBrowserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingKpiNames: Set<string>;
  onAddKpi: (kpi: KPI) => void;
}

export function KPIBrowserSheet({ open, onOpenChange, existingKpiNames, onAddKpi }: KPIBrowserSheetProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    let items = mockKPIs;
    if (category !== "all") items = items.filter(k => k.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(k => k.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q));
    }
    // Pin AI-suggested to top
    return [...items].sort((a, b) => {
      if (a.isAISuggested && !b.isAISuggested) return -1;
      if (!a.isAISuggested && b.isAISuggested) return 1;
      return 0;
    });
  }, [search, category]);

  const getReasonColor = (reason?: string) => {
    if (!reason) return "text-muted-foreground";
    const r = reason.toLowerCase();
    if (r.includes("high impact") || r.includes("strong") || r.includes("drove") || r.includes("proven") || r.includes("synergistic") || r.includes("scalable") || r.includes("effective")) return "text-[hsl(var(--success))]";
    if (r.includes("risky") || r.includes("low") || r.includes("cautious") || r.includes("complex") || r.includes("hard to")) return "text-destructive";
    const att = reason.match(/(\d+)%/);
    if (att) {
      const val = parseInt(att[1]);
      if (val >= 70) return "text-[hsl(var(--success))]";
      if (val >= 50) return "text-[hsl(var(--warning))]";
      return "text-destructive";
    }
    return "text-muted-foreground";
  };

  const categoryColors: Record<string, string> = {
    sales: "bg-blue-100 text-blue-700",
    distribution: "bg-emerald-100 text-emerald-700",
    visibility: "bg-amber-100 text-amber-700",
    compliance: "bg-purple-100 text-purple-700",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-base font-semibold">KPI Library</SheetTitle>
          <p className="text-xs text-muted-foreground">Browse and add KPIs — AI insights included</p>
        </SheetHeader>

        <div className="px-5 pt-4 pb-2 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search KPIs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map(c => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-medium transition-colors",
                  category === c.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 px-5 pb-5">
          <div className="space-y-2 pr-2">
            {filtered.map(kpi => {
              const added = existingKpiNames.has(kpi.name);
              return (
                <button
                  key={kpi.id}
                  disabled={added}
                  onClick={() => { onAddKpi(kpi); }}
                  className={cn(
                    "w-full text-left rounded-lg border p-3.5 transition-all",
                    added
                      ? "border-primary/20 bg-primary/5 opacity-60 cursor-default"
                      : "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer",
                    kpi.isAISuggested && !added && "border-primary/30 bg-primary/[0.03]"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">{kpi.name}</span>
                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", categoryColors[kpi.category])}>
                      {kpi.category}
                    </Badge>
                    {kpi.isAISuggested && (
                      <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary px-1.5 py-0">
                        <Sparkles size={8} className="mr-0.5" /> AI Pick
                      </Badge>
                    )}
                    {added && (
                      <Check size={14} className="ml-auto text-primary" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">{kpi.description}</p>
                  {kpi.aiReason && (
                    <div className="flex items-start gap-1.5">
                      <Info size={10} className={cn("shrink-0 mt-0.5", getReasonColor(kpi.aiReason))} />
                      <p className={cn("text-[10px] italic leading-relaxed", getReasonColor(kpi.aiReason))}>
                        {kpi.aiReason}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No KPIs match your search</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
