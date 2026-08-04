import { useMemo, useState } from "react";
import { Search, Plus, MoreHorizontal, Eye, Check, X, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { StatusPill, MethodMixBar } from "./PayoutBits";
import { fmt, methodMix, RUN_LIFECYCLE, type PayoutRun, type RunStatus } from "./payoutData";

interface Props {
  runs: PayoutRun[];
  onOpen: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExport: (id: string) => void;
  onRetry: (id: string) => void;
  onNewRun: () => void;
}

export function RunsTable({ runs, onOpen, onApprove, onReject, onExport, onRetry, onNewRun }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [programme, setProgramme] = useState("all");

  const periods = Array.from(new Set(runs.map((r) => r.period)));
  const programmes = Array.from(new Set(runs.map((r) => r.programme)));

  const filtered = useMemo(
    () =>
      runs.filter((r) => {
        if (q && !`${r.id} ${r.programme}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (status !== "all" && r.status !== status) return false;
        if (period !== "all" && r.period !== period) return false;
        if (programme !== "all" && r.programme !== programme) return false;
        return true;
      }),
    [runs, q, status, period, programme]
  );

  const activeFilters = [status, period, programme].filter((v) => v !== "all").length + (q ? 1 : 0);
  const clear = () => {
    setQ("");
    setStatus("all");
    setPeriod("all");
    setProgramme("all");
  };

  const pillCls = (on: boolean) =>
    cn("h-9 w-[150px] text-xs", on && "border-primary ring-1 ring-primary/30");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search run ID or programme"
            className={cn("h-9 w-64 pl-8 text-xs", q && "border-primary ring-1 ring-primary/30")}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={pillCls(status !== "all")}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RUN_LIFECYCLE.concat("Partially failed" as RunStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className={pillCls(period !== "all")}>
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All periods</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={programme} onValueChange={setProgramme}>
          <SelectTrigger className={cn(pillCls(programme !== "all"), "w-[200px]")}>
            <SelectValue placeholder="Programme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programmes</SelectItem>
            {programmes.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {runs.length} runs
          </span>
          {activeFilters > 0 && (
            <button onClick={clear} className="text-xs font-medium text-primary hover:underline">
              Clear filters
            </button>
          )}
          <Button size="sm" className="h-9 gap-1.5" onClick={onNewRun}>
            <Plus size={14} /> New payout run
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[150px]" />
            <col />
            <col className="w-[90px]" />
            <col className="w-[70px]" />
            <col className="w-[130px]" />
            <col className="w-[130px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-semibold">Run ID</th>
              <th className="px-3 py-2.5 text-left font-semibold">Programme</th>
              <th className="px-3 py-2.5 text-left font-semibold">Period</th>
              <th className="px-3 py-2.5 text-right font-semibold">Reps</th>
              <th className="px-3 py-2.5 text-right font-semibold">Total payout</th>
              <th className="px-3 py-2.5 text-left font-semibold">Paid by</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const canApprove = r.status === "Awaiting Sales Ops" || r.status === "Awaiting Finance";
              const canRetry = r.status === "Partially failed";
              return (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onOpen(r.id)}
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {r.id}
                    </button>
                    <div className="text-[10px] text-muted-foreground">Created {r.createdAt}</div>
                  </td>
                  <td className="truncate px-3 py-3 text-xs font-medium text-foreground">{r.programme}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{r.period}</td>
                  <td className="px-3 py-3 text-right text-xs tabular-nums">{r.totalReps}</td>
                  <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums">{fmt(r.totalAmount)}</td>
                  <td className="px-3 py-3">
                    <MethodMixBar mix={methodMix(r)} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canApprove && (
                        <Button size="sm" className="h-7 gap-1 px-2.5 text-[11px]" onClick={() => onApprove(r.id)}>
                          <Check size={12} /> Approve
                        </Button>
                      )}
                      {canRetry && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2.5 text-[11px]"
                          onClick={() => onRetry(r.id)}
                        >
                          <RotateCcw size={12} /> Retry
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onOpen(r.id)}>
                            <Eye size={14} className="mr-2" /> View details
                          </DropdownMenuItem>
                          {canApprove && (
                            <>
                              <DropdownMenuItem onClick={() => onApprove(r.id)}>
                                <Check size={14} className="mr-2" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onReject(r.id)}>
                                <X size={14} className="mr-2" /> Reject / hold
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => onExport(r.id)}>
                            <Download size={14} className="mr-2" /> Export bank file
                          </DropdownMenuItem>
                          {canRetry && (
                            <DropdownMenuItem onClick={() => onRetry(r.id)}>
                              <RotateCcw size={14} className="mr-2" /> Retry failed
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No payout runs match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
