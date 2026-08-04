import { useState } from "react";
import { Plus, Search, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmt, type Dispute } from "./payoutData";

const style: Record<Dispute["status"], string> = {
  Open: "bg-rose-50 text-rose-700 border-rose-200",
  "Under Review": "bg-amber-50 text-amber-700 border-amber-200",
  Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-slate-100 text-slate-600 border-slate-300",
};

export function DisputesTable({
  disputes,
  onResolve,
  onReview,
  onRaise,
}: {
  disputes: Dispute[];
  onResolve: (id: string) => void;
  onReview: (id: string) => void;
  onRaise: () => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = disputes.filter((d) => {
    if (q && !`${d.id} ${d.rep} ${d.programme}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "all" && d.status !== status) return false;
    return true;
  });

  const open = disputes.filter((d) => d.status === "Open" || d.status === "Under Review");
  const value = open.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rep or dispute ID"
            className="h-9 w-64 pl-8 text-xs"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["Open", "Under Review", "Resolved", "Rejected"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {open.length} open · {fmt(value)} under query
        </span>
        <Button size="sm" className="ml-auto h-9 gap-1.5" onClick={onRaise}>
          <Plus size={14} /> Raise dispute
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[90px]" />
            <col className="w-[140px]" />
            <col className="w-[130px]" />
            <col />
            <col className="w-[100px]" />
            <col className="w-[70px]" />
            <col className="w-[120px]" />
            <col className="w-[170px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-semibold">ID</th>
              <th className="px-3 py-2.5 text-left font-semibold">Rep</th>
              <th className="px-3 py-2.5 text-left font-semibold">Run</th>
              <th className="px-3 py-2.5 text-left font-semibold">Reason</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-3 py-2.5 text-right font-semibold">Age</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-border/60 last:border-0 align-top hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-[11px] font-semibold text-foreground">{d.id}</td>
                <td className="px-3 py-3">
                  <div className="text-xs font-medium text-foreground">{d.rep}</div>
                  <div className="text-[10px] text-muted-foreground">{d.programme}</div>
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{d.runId}</td>
                <td className="px-3 py-3 text-[11px] text-muted-foreground">
                  {d.reason}
                  {d.resolutionNote && (
                    <div className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">
                      Resolution: {d.resolutionNote}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums">{fmt(d.amount)}</td>
                <td
                  className={cn(
                    "px-3 py-3 text-right text-xs tabular-nums",
                    d.ageDays > 21 && d.status !== "Resolved" ? "font-semibold text-rose-600" : "text-muted-foreground"
                  )}
                >
                  {d.ageDays}d
                </td>
                <td className="px-3 py-3">
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", style[d.status])}>
                    {d.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    {d.status === "Open" && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => onReview(d.id)}>
                        <AlertTriangle size={12} /> Review
                      </Button>
                    )}
                    {d.status !== "Resolved" && d.status !== "Rejected" && (
                      <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => onResolve(d.id)}>
                        <Check size={12} /> Resolve
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No disputes match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
