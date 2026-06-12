import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiConfig, Programme } from "@/types/programme";
import {
  formatPeriod,
  formatType,
  channelTone,
  generateProgrammeSuggestions,
  bumpPeriod,
  KPI_LABELS,
  type KpiSuggestion,
} from "./programmeCloneUtils";

interface MultiCloneViewProps {
  programs: Programme[];
  onBack: () => void;
  onConfirm: () => void;
}

interface CardState {
  expanded: boolean;
  /** parallel to suggestions array */
  accepted: boolean[];
  newPeriod: Programme["period"];
}

export function MultiCloneView({ programs, onBack, onConfirm }: MultiCloneViewProps) {
  const cards = useMemo(
    () => programs.map((p) => ({
      programme: p,
      suggestions: generateProgrammeSuggestions(p),
      newPeriod: bumpPeriod(p.period, 1),
    })),
    [programs],
  );

  const [state, setState] = useState<CardState[]>(() =>
    cards.map((c, i) => ({
      expanded: i === 0,
      accepted: c.suggestions.map(() => true),
      newPeriod: c.newPeriod,
    })),
  );

  const totals = useMemo(() => {
    const total = state.reduce((s, st) => s + st.accepted.length, 0);
    const accepted = state.reduce((s, st) => s + st.accepted.filter(Boolean).length, 0);
    return { total, accepted };
  }, [state]);

  const update = (idx: number, patch: Partial<CardState>) => {
    setState((arr) => arr.map((st, i) => (i === idx ? { ...st, ...patch } : st)));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
      <div className="border-b border-border bg-card px-6 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
            <ArrowLeft size={14} /> Back
          </Button>
          <span className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">AI-improved clones</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{totals.accepted}</span> of{" "}
            <span className="tabular-nums">{totals.total}</span> suggestions accepted across {programs.length} programmes
          </span>
          <Button size="sm" onClick={onConfirm}>Confirm all</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-3">
          {cards.map((c, idx) => {
            const st = state[idx];
            const acceptedCount = st.accepted.filter(Boolean).length;
            const confidence: "High" | "Medium" =
              c.suggestions.length >= 3 ? "High" : "Medium";
            return (
              <Collapsible
                key={c.programme.id}
                open={st.expanded}
                onOpenChange={(v) => update(idx, { expanded: v })}
              >
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* Header */}
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        <ChevronDown
                          size={14}
                          className={cn("text-muted-foreground transition-transform shrink-0", !st.expanded && "-rotate-90")}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{c.programme.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px]", channelTone(c.programme.channel))}>
                              {formatType(c.programme)}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatPeriod(c.programme.period)} → {formatPeriod(st.newPeriod)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded border",
                            confidence === "High"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200",
                          )}
                        >
                          {confidence} confidence
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {acceptedCount}/{st.accepted.length} accepted
                        </span>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t border-border">
                      <SuggestionTable
                        programme={c.programme}
                        suggestions={c.suggestions}
                        accepted={st.accepted}
                        onToggle={(i) => {
                          const a = [...st.accepted];
                          a[i] = !a[i];
                          update(idx, { accepted: a });
                        }}
                      />
                      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => update(idx, { accepted: st.accepted.map(() => true) })}>
                            Accept all
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => update(idx, { accepted: st.accepted.map(() => false) })}>
                            Reject all
                          </Button>
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {acceptedCount}/{st.accepted.length} accepted
                        </span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SuggestionTable({
  programme, suggestions, accepted, onToggle,
}: {
  programme: Programme;
  suggestions: KpiSuggestion[];
  accepted: boolean[];
  onToggle: (i: number) => void;
}) {
  // Build a row per programme KPI (suggested or not)
  const enabledKpiKeys = (Object.entries(programme.kpis) as [keyof Programme["kpis"], KpiConfig | undefined][])
    .filter(([, v]) => v?.enabled)
    .map(([k]) => k);

  const sugByKey = new Map<string, { idx: number; sug: KpiSuggestion }>();
  suggestions.forEach((s, i) => sugByKey.set(s.kpiKey, { idx: i, sug: s }));

  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="text-left px-4 py-2">KPI</th>
          <th className="text-left px-4 py-2">Current</th>
          <th className="text-left px-4 py-2">AI suggested</th>
          <th className="text-left px-4 py-2">Reason</th>
          <th className="text-right px-4 py-2 w-[88px]">Accept</th>
        </tr>
      </thead>
      <tbody>
        {enabledKpiKeys.map((k) => {
          const hit = sugByKey.get(k as string);
          if (!hit) {
            return (
              <tr key={k} className="border-t border-border text-muted-foreground">
                <td className="px-4 py-2.5">{KPI_LABELS[k]}</td>
                <td className="px-4 py-2.5 text-xs">—</td>
                <td className="px-4 py-2.5 text-xs italic">No change suggested</td>
                <td className="px-4 py-2.5 text-xs">—</td>
                <td className="px-4 py-2.5"></td>
              </tr>
            );
          }
          const { idx, sug } = hit;
          return (
            <tr key={k} className="border-t border-border">
              <td className="px-4 py-2.5 font-medium text-foreground">
                {sug.label}
                <div className="text-[10px] text-muted-foreground font-normal">{sug.field}</div>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums line-through">{sug.current}</td>
              <td className="px-4 py-2.5 text-xs font-semibold text-foreground tabular-nums">{sug.suggested}</td>
              <td className="px-4 py-2.5 text-[11px] text-muted-foreground leading-snug">{sug.reason}</td>
              <td className="px-4 py-2.5 text-right">
                <Switch checked={accepted[idx]} onCheckedChange={() => onToggle(idx)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
