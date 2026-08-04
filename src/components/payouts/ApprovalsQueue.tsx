import { Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusPill } from "./PayoutBits";
import { fmt, type PayoutRun } from "./payoutData";

interface Props {
  runs: PayoutRun[];
  onOpen: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function ApprovalsQueue({ runs, onOpen, onApprove, onReject }: Props) {
  const queue = runs.filter((r) => r.status === "Awaiting Sales Ops" || r.status === "Awaiting Finance");

  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <Check className="mx-auto mb-3 text-emerald-500" size={28} />
        <h3 className="text-sm font-semibold text-foreground">Nothing awaiting approval</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Every calculated run has cleared both approval levels.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {queue.length} run{queue.length > 1 ? "s" : ""} waiting on you. Two-step approval requires a Sales Ops sign-off
        before Finance can release the money.
      </p>
      {queue.map((r) => {
        const stage = r.status === "Awaiting Sales Ops" ? "Step 1 — Sales Ops" : "Step 2 — Finance";
        return (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpen(r.id)}
                    className="font-mono text-xs font-bold text-primary hover:underline"
                  >
                    {r.id}
                  </button>
                  <StatusPill status={r.status} />
                </div>
                <div className="mt-0.5 text-sm font-semibold text-foreground">{r.programme}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.period} · {r.totalReps} reps · created {r.createdAt}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total payout</div>
                <div className="text-lg font-bold tabular-nums text-foreground">{fmt(r.totalAmount)}</div>
              </div>

              <div className="flex min-w-[220px] flex-col gap-1">
                {r.approvals.map((a) => (
                  <div key={a.level} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full",
                        a.state === "Approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : a.state === "Rejected"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {a.state === "Approved" ? <Check size={10} /> : a.state === "Rejected" ? <X size={10} /> : <Clock size={10} />}
                    </span>
                    <span className={cn("font-medium", a.level === stage && "text-primary")}>{a.level}</span>
                    <span className="text-muted-foreground">
                      {a.state}
                      {a.at ? ` · ${a.at}` : ""}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onReject(r.id)}>
                  <X size={14} /> Reject
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => onApprove(r.id)}>
                  <Check size={14} /> Approve {stage.split(" ")[0]}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
