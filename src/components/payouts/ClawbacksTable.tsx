import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmt, type Clawback } from "./payoutData";

const style: Record<Clawback["status"], string> = {
  Scheduled: "bg-amber-50 text-amber-700 border-amber-200",
  "Partially recovered": "bg-sky-50 text-sky-700 border-sky-200",
  Recovered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Waived: "bg-slate-100 text-slate-600 border-slate-300",
};

export function ClawbacksTable({
  clawbacks,
  onAdd,
  onWaive,
}: {
  clawbacks: Clawback[];
  onAdd: () => void;
  onWaive: (id: string) => void;
}) {
  const outstanding = clawbacks.reduce((s, c) => s + (c.amount - c.recovered), 0);
  const recovered = clawbacks.reduce((s, c) => s + c.recovered, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {fmt(outstanding)} outstanding · {fmt(recovered)} recovered across {clawbacks.length} entries
        </span>
        <Button size="sm" className="ml-auto h-9 gap-1.5" onClick={onAdd}>
          <Plus size={14} /> Add recovery
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[90px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            <col className="w-[110px]" />
            <col />
            <col className="w-[120px]" />
            <col className="w-[160px]" />
            <col className="w-[110px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-semibold">ID</th>
              <th className="px-3 py-2.5 text-left font-semibold">Rep</th>
              <th className="px-3 py-2.5 text-left font-semibold">Original run</th>
              <th className="px-3 py-2.5 text-left font-semibold">Reason</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-3 py-2.5 text-left font-semibold">Recovery</th>
              <th className="px-3 py-2.5 text-left font-semibold">Next cycle</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="px-3 py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {clawbacks.map((c) => {
              const pct = c.amount ? Math.round((c.recovered / c.amount) * 100) : 0;
              return (
                <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-[11px] font-semibold text-foreground">{c.id}</td>
                  <td className="px-3 py-3 text-xs font-medium text-foreground">{c.rep}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{c.originalRunId}</td>
                  <td className="px-3 py-3 text-[11px] text-muted-foreground">{c.reason}</td>
                  <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums">{fmt(c.amount)}</td>
                  <td className="px-3 py-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {fmt(c.recovered)} of {fmt(c.amount)} ({pct}%)
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-muted-foreground">{c.nextCycle}</td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", style[c.status])}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {c.status !== "Recovered" && c.status !== "Waived" && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => onWaive(c.id)}>
                        <RotateCcw size={12} /> Waive
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
