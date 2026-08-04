import { Fragment, useState } from "react";
import { ArrowLeft, Download, Check, X, ChevronDown, ChevronRight, RotateCcw, ShieldCheck, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { StatusPill, MethodPill, MethodDonut } from "./PayoutBits";
import {
  fmt,
  methodMix,
  METHOD_LABEL,
  METHOD_HEX,
  type PayoutRun,
  type RepPayout,
} from "./payoutData";

interface Props {
  run: PayoutRun;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
  onExport: () => void;
  onRetry: () => void;
  onMarkPaid: (utr: string) => void;
  onOpenRep: (rep: RepPayout) => void;
}

const repStatusStyle: Record<string, string> = {
  Pending: "bg-muted text-muted-foreground border-border",
  Approved: "bg-blue-50 text-blue-700 border-blue-200",
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Failed: "bg-rose-50 text-rose-700 border-rose-200",
  Disputed: "bg-amber-50 text-amber-700 border-amber-200",
  "On hold": "bg-slate-100 text-slate-700 border-slate-300",
};

export function RunDetail({ run, onBack, onApprove, onReject, onExport, onRetry, onMarkPaid, onOpenRep }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [utr, setUtr] = useState(run.utr ?? "");
  const mix = methodMix(run);
  const failed = run.reps.filter((r) => r.status === "Failed");
  const sampleNet = run.reps.reduce((s, r) => s + r.net, 0) || 1;
  // The rep table shows a representative sample; the strip reports the full run,
  // scaled from the sample so the components always reconcile to the run total.
  const scale = run.totalAmount / sampleNet;
  const gross = Math.round(run.reps.reduce((s, r) => s + r.gross, 0) * scale);
  const deductions = Math.round(run.reps.reduce((s, r) => s + r.gateDeduction, 0) * scale);
  const clawed = Math.round(run.reps.reduce((s, r) => s + r.clawbackAdj, 0) * scale);
  const net = run.totalAmount;
  const canApprove = run.status === "Awaiting Sales Ops" || run.status === "Awaiting Finance";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft size={14} /> All runs
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-base font-bold text-foreground">{run.id}</h2>
            <StatusPill status={run.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {run.programme} · {run.period} · {run.totalReps} reps
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
            <Download size={14} /> Bank file
          </Button>
          {run.status === "Partially failed" && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
              <RotateCcw size={14} /> Retry failed
            </Button>
          )}
          {canApprove && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onReject}>
                <X size={14} /> Reject / hold
              </Button>
              <Button size="sm" className="gap-1.5" onClick={onApprove}>
                <Check size={14} /> Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total earned", fmt(gross), "bg-teal-50 text-teal-800"],
            ["Not met (gates)", `− ${fmt(deductions)}`, "bg-amber-50 text-amber-800"],
            ["Recovered back", fmt(clawed), "bg-rose-50 text-rose-800"],
            ["Net to pay", fmt(net), "bg-violet-50 text-violet-800"],
          ].map(([label, value, tone]) => (
            <div key={label} className={cn("rounded-2xl border border-border/60 p-3", tone)}>
              <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
              <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
            </div>
          ))}
          <div className="col-span-2 rounded-2xl border border-border bg-card p-3 sm:col-span-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Approval steps
            </div>
            <div className="flex flex-wrap gap-4">
              {run.approvals.map((a) => (
                <div key={a.level} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                      a.state === "Approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : a.state === "Rejected"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {a.state === "Approved" ? <Check size={11} /> : a.state === "Rejected" ? <X size={11} /> : <Clock size={11} />}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{a.level}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.approver} · {a.state}
                      {a.at ? ` · ${a.at}` : ""}
                    </div>
                    {a.comment && <div className="text-[11px] italic text-muted-foreground">"{a.comment}"</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            How this run is paid
          </div>
          <div className="flex items-center gap-3">
            <MethodDonut mix={mix} size={110} />
            <div className="space-y-1.5">
              {mix.map((m) => (
                <div key={m.method} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: METHOD_HEX[m.method] }} />
                  <span className="text-muted-foreground">{METHOD_LABEL[m.method]}</span>
                  <span className="font-semibold tabular-nums">{m.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Failed payouts */}
      {failed.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-rose-800">
              {failed.length} failed payout{failed.length > 1 ? "s" : ""} need attention
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onRetry}>
              <RotateCcw size={12} /> Retry all
            </Button>
          </div>
          <div className="space-y-1">
            {failed.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-[11px] text-rose-900">
                <span className="font-medium">
                  {f.name} · {f.code}
                </span>
                <span className="text-rose-700">{f.failureReason}</span>
                <span className="font-semibold tabular-nums">{fmt(f.net)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rep table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-xs font-semibold text-foreground">Rep-level breakdown</span>
          <span className="text-[10px] text-muted-foreground">
            Showing {run.reps.length} of {run.totalReps} reps · click a row for KPI contribution
          </span>
        </div>
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[32px]" />
            <col />
            <col className="w-[90px]" />
            <col className="w-[100px]" />
            <col className="w-[110px]" />
            <col className="w-[100px]" />
            <col className="w-[110px]" />
            <col className="w-[130px]" />
            <col className="w-[100px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th />
              <th className="px-3 py-2 text-left font-semibold">Rep</th>
              <th className="px-3 py-2 text-left font-semibold">Region</th>
              <th className="px-3 py-2 text-right font-semibold">Gross</th>
              <th className="px-3 py-2 text-right font-semibold">Gate cut</th>
              <th className="px-3 py-2 text-right font-semibold">Recovered back</th>
              <th className="px-3 py-2 text-right font-semibold">Net</th>
              <th className="px-3 py-2 text-left font-semibold">Paid by</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {run.reps.map((rep) => {
              const open = expanded === rep.id;
              return (
                <Fragment key={rep.id}>
                  <tr
                    className="cursor-pointer border-b border-border/60 hover:bg-muted/30"
                    onClick={() => setExpanded(open ? null : rep.id)}
                  >
                    <td className="pl-3 text-muted-foreground">
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        className="text-xs font-semibold text-foreground hover:text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRep(rep);
                        }}
                      >
                        {rep.name}
                      </button>
                      <div className="text-[10px] text-muted-foreground">
                        {rep.code} · {rep.role}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{rep.region}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">{fmt(rep.gross)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-amber-700">
                      {rep.gateDeduction ? `− ${fmt(rep.gateDeduction)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-rose-700">
                      {rep.clawbackAdj ? fmt(rep.clawbackAdj) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">{fmt(rep.net)}</td>
                    <td className="px-3 py-2.5">
                      <MethodPill method={rep.method} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          repStatusStyle[rep.status]
                        )}
                      >
                        {rep.status}
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border/60 bg-muted/20">
                      <td />
                      <td colSpan={8} className="px-3 py-3">
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          KPI contribution
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {rep.kpis.map((k) => (
                            <div key={k.kpi} className="rounded-xl border border-border bg-card p-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">{k.kpi}</span>
                                <span className="text-[10px] text-muted-foreground">wt {k.weight}%</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    k.achievementPct >= 90
                                      ? "bg-emerald-500"
                                      : k.achievementPct >= 70
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  )}
                                  style={{ width: `${Math.min(100, k.achievementPct)}%` }}
                                />
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{k.achievementPct}% attained</span>
                                <span className="font-semibold text-foreground">{fmt(k.payout)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirm payment + audit */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ShieldCheck size={14} className="text-primary" /> Confirm payment
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Enter the bank or provider reference number once the payment has gone through. This closes the run and locks edits.
          </p>
          <div className="flex gap-2">
            <Input
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="Bank / provider reference no."
              className="h-9 text-xs"
            />
            <Button size="sm" className="h-9" disabled={!utr} onClick={() => onMarkPaid(utr)}>
              Mark paid
            </Button>
          </div>
          {run.utr && (
            <div className="mt-2 text-[11px] text-emerald-700">Reference · {run.utr}</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <FileText size={14} className="text-primary" /> Activity log
          </div>
          <ol className="space-y-2.5 border-l border-border pl-4">
            {run.audit.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                <div className="text-[11px] font-semibold text-foreground">{e.action}</div>
                <div className="text-[10px] text-muted-foreground">
                  {e.actor} · {e.at}
                  {e.detail ? ` · ${e.detail}` : ""}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
