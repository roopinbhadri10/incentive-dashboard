import { useMemo, useState } from "react";
import { Wallet, Clock, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { RunsTable } from "@/components/payouts/RunsTable";
import { RunDetail } from "@/components/payouts/RunDetail";
import { ApprovalsQueue } from "@/components/payouts/ApprovalsQueue";
import { RewardsPanel } from "@/components/payouts/RewardsPanel";
import { DisputesTable } from "@/components/payouts/DisputesTable";
import { ClawbacksTable } from "@/components/payouts/ClawbacksTable";
import { RepPayoutDrawer } from "@/components/payouts/RepPayoutDrawer";
import { StatusPill } from "@/components/payouts/PayoutBits";
import {
  INITIAL_CLAWBACKS,
  INITIAL_DISPUTES,
  INITIAL_POLICIES,
  INITIAL_PROVIDERS,
  INITIAL_REDEMPTIONS,
  INITIAL_RUNS,
  fmt,
  fmtCompact,
  makeReps,
  type Clawback,
  type Dispute,
  type MethodPolicy,
  type PayoutRun,
  type Redemption,
  type RepPayout,
  type RewardProvider,
} from "@/components/payouts/payoutData";

const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

export function PayoutManagementPage() {
  const [runs, setRuns] = useState<PayoutRun[]>(INITIAL_RUNS);
  const [disputes, setDisputes] = useState<Dispute[]>(INITIAL_DISPUTES);
  const [clawbacks, setClawbacks] = useState<Clawback[]>(INITIAL_CLAWBACKS);
  const [providers, setProviders] = useState<RewardProvider[]>(INITIAL_PROVIDERS);
  const [policies, setPolicies] = useState<MethodPolicy[]>(INITIAL_POLICIES);
  const [redemptions, setRedemptions] = useState<Redemption[]>(INITIAL_REDEMPTIONS);

  const [tab, setTab] = useState("runs");
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [drawerRep, setDrawerRep] = useState<RepPayout | null>(null);

  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resolveFor, setResolveFor] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [showNewRun, setShowNewRun] = useState(false);
  const [showRaiseDispute, setShowRaiseDispute] = useState(false);
  const [showAddClawback, setShowAddClawback] = useState(false);

  const openRun = openRunId ? runs.find((r) => r.id === openRunId) ?? null : null;

  // ── Derived summary ──────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const pending = runs.filter((r) => r.status === "Awaiting Sales Ops" || r.status === "Awaiting Finance");
    const paid = runs.filter((r) => r.status === "Paid" || r.status === "Closed");
    const inFlight = runs.filter((r) => r.status === "Approved" || r.status === "Processing");
    const failedCount = runs.reduce(
      (s, r) => s + r.reps.filter((x) => x.status === "Failed").length,
      0
    );
    return {
      pendingValue: pending.reduce((s, r) => s + r.totalAmount, 0),
      pendingCount: pending.length,
      paidValue: paid.reduce((s, r) => s + r.totalAmount, 0),
      paidCount: paid.length,
      inFlightValue: inFlight.reduce((s, r) => s + r.totalAmount, 0),
      inFlightCount: inFlight.length,
      disputesOpen: disputes.filter((d) => d.status !== "Resolved" && d.status !== "Rejected").length,
      disputesValue: disputes
        .filter((d) => d.status !== "Resolved" && d.status !== "Rejected")
        .reduce((s, d) => s + d.amount, 0),
      clawbackOutstanding: clawbacks.reduce((s, c) => s + (c.amount - c.recovered), 0),
      failedCount,
    };
  }, [runs, disputes, clawbacks]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const pushAudit = (id: string, action: string, detail?: string, actor = "Kushagra") =>
    setRuns((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, audit: [...r.audit, { at: now(), actor, action, detail }] } : r
      )
    );

  const approveRun = (id: string) => {
    setRuns((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        if (r.status === "Awaiting Sales Ops") {
          return {
            ...r,
            status: "Awaiting Finance",
            approvals: r.approvals.map((a) =>
              a.level === "Step 1 — Sales Ops" ? { ...a, state: "Approved" as const, at: now() } : a
            ),
            audit: [...r.audit, { at: now(), actor: "Kushagra", action: "Sales Ops approved" }],
          };
        }
        return {
          ...r,
          status: "Approved",
          approvals: r.approvals.map((a) =>
            a.level === "Step 2 — Finance" ? { ...a, state: "Approved" as const, at: now() } : a
          ),
          audit: [...r.audit, { at: now(), actor: "Kushagra", action: "Finance approved" }],
        };
      })
    );
    toast.success(`${id} approved`, { description: "Moved to the next stage of the payout workflow." });
  };

  const submitReject = () => {
    if (!rejectFor) return;
    setRuns((rs) =>
      rs.map((r) =>
        r.id === rejectFor
          ? {
              ...r,
              status: "Calculated",
              rejectionReason: rejectReason,
              approvals: r.approvals.map((a) =>
                a.state === "Pending" ? { ...a, state: "Rejected" as const, at: now(), comment: rejectReason } : a
              ),
              audit: [...r.audit, { at: now(), actor: "Kushagra", action: "Rejected / held", detail: rejectReason }],
            }
          : r
      )
    );
    toast.error(`${rejectFor} sent back`, { description: rejectReason });
    setRejectFor(null);
    setRejectReason("");
  };

  const retryFailed = (id: string) => {
    setRuns((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "Processing",
              reps: r.reps.map((x) =>
                x.status === "Failed" ? { ...x, status: "Pending" as const, failureReason: undefined } : x
              ),
              audit: [...r.audit, { at: now(), actor: "Kushagra", action: "Retried failed payouts" }],
            }
          : r
      )
    );
    toast.success("Retry queued", { description: "Failed payouts re-submitted to the provider." });
  };

  const markPaid = (id: string, utr: string) => {
    setRuns((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "Paid",
              utr,
              reps: r.reps.map((x) => (x.status === "Failed" ? x : { ...x, status: "Paid" as const })),
              audit: [...r.audit, { at: now(), actor: "Kushagra", action: "Marked paid", detail: `UTR ${utr}` }],
            }
          : r
      )
    );
    toast.success("Payment confirmed", { description: `Reference ${utr} recorded.` });
  };

  const exportRun = (id: string) => {
    pushAudit(id, "Bank file exported");
    toast.success(`Export queued · ${id}.csv`);
  };

  const toggleProvider = (id: string) => {
    setProviders((ps) =>
      ps.map((p) =>
        p.id === id ? { ...p, connected: !p.connected, float: p.connected ? 0 : 500_000 } : p
      )
    );
    const p = providers.find((x) => x.id === id);
    toast.success(p?.connected ? `${p.name} disconnected` : `${p?.name} connected`, {
      description: "Simulated connection — no live provider credentials are used yet.",
    });
  };

  const updatePolicy = (programme: string, patch: Partial<MethodPolicy>) =>
    setPolicies((ps) => ps.map((p) => (p.programme === programme ? { ...p, ...patch } : p)));

  const resendReward = (id: string) => {
    setRedemptions((rs) => rs.map((r) => (r.id === id ? { ...r, status: "Delivered" } : r)));
    toast.success("Reward re-issued", { description: "A fresh code was sent to the rep." });
  };

  const summaryCards = [
    {
      label: "Pending approval",
      value: fmtCompact(summary.pendingValue),
      sub: `${summary.pendingCount} runs`,
      tone: "bg-amber-50 text-amber-800 border-amber-100",
      icon: Clock,
    },
    {
      label: "Paid this cycle",
      value: fmtCompact(summary.paidValue),
      sub: `${summary.paidCount} runs closed`,
      tone: "bg-emerald-50 text-emerald-800 border-emerald-100",
      icon: CheckCircle2,
    },
    {
      label: "Being paid now",
      value: fmtCompact(summary.inFlightValue),
      sub: `${summary.inFlightCount} paying out`,
      tone: "bg-sky-50 text-sky-800 border-sky-100",
      icon: Wallet,
    },
    {
      label: "Disputes open",
      value: String(summary.disputesOpen),
      sub: `${fmtCompact(summary.disputesValue)} under query`,
      tone: "bg-violet-50 text-violet-800 border-violet-100",
      icon: AlertTriangle,
    },
    {
      label: "To recover",
      value: fmtCompact(summary.clawbackOutstanding),
      sub: "money to take back",
      tone: "bg-rose-50 text-rose-800 border-rose-100",
      icon: RotateCcw,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="surface-panel mx-auto max-w-[1400px] rounded-3xl border border-border p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-[26px] w-1 rounded-full bg-primary" />
          <p className="text-xs text-muted-foreground">
            Work out, approve, pay and confirm rep incentives — cash or rewards.
          </p>
        </div>


        {/* Summary strip */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {summaryCards.map((c) => (
            <div key={c.label} className={cn("rounded-2xl border p-3.5", c.tone)}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{c.label}</span>
                <c.icon size={14} className="opacity-60" />
              </div>
              <div className="mt-1.5 text-xl font-bold tabular-nums">{c.value}</div>
              <div className="text-[11px] opacity-70">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        {openRun ? (
          <div className="mt-6">
            <RunDetail
              run={openRun}
              onBack={() => setOpenRunId(null)}
              onApprove={() => approveRun(openRun.id)}
              onReject={() => setRejectFor(openRun.id)}
              onExport={() => exportRun(openRun.id)}
              onRetry={() => retryFailed(openRun.id)}
              onMarkPaid={(utr) => markPaid(openRun.id, utr)}
              onOpenRep={setDrawerRep}
            />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="runs">Runs</TabsTrigger>
              <TabsTrigger value="approvals">
                Approvals
                {summary.pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                    {summary.pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="rewards">Rewards & redemption</TabsTrigger>
              <TabsTrigger value="disputes">
                Disputes
                {summary.disputesOpen > 0 && (
                  <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                    {summary.disputesOpen}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="clawbacks">Recoveries</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="runs" className="mt-4 space-y-3">
              <LifecycleLegend />
              <RunsTable
                runs={runs}
                onOpen={setOpenRunId}
                onApprove={approveRun}
                onReject={setRejectFor}
                onExport={exportRun}
                onRetry={retryFailed}
                onNewRun={() => setShowNewRun(true)}
              />
            </TabsContent>

            <TabsContent value="approvals" className="mt-4">
              <ApprovalsQueue
                runs={runs}
                onOpen={setOpenRunId}
                onApprove={approveRun}
                onReject={setRejectFor}
              />
            </TabsContent>

            <TabsContent value="rewards" className="mt-4">
              <RewardsPanel
                providers={providers}
                onToggleProvider={toggleProvider}
                policies={policies}
                onUpdatePolicy={updatePolicy}
                redemptions={redemptions}
                onResend={resendReward}
              />
            </TabsContent>

            <TabsContent value="disputes" className="mt-4">
              <DisputesTable
                disputes={disputes}
                onRaise={() => setShowRaiseDispute(true)}
                onReview={(id) =>
                  setDisputes((ds) => ds.map((d) => (d.id === id ? { ...d, status: "Under Review" } : d)))
                }
                onResolve={(id) => setResolveFor(id)}
              />
            </TabsContent>

            <TabsContent value="clawbacks" className="mt-4">
              <ClawbacksTable
                clawbacks={clawbacks}
                onAdd={() => setShowAddClawback(true)}
                onWaive={(id) =>
                  setClawbacks((cs) => cs.map((c) => (c.id === id ? { ...c, status: "Waived" } : c)))
                }
              />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <HistoryView runs={runs} onOpen={setOpenRunId} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <RepPayoutDrawer
        rep={drawerRep}
        runs={runs}
        redemptions={redemptions}
        disputes={disputes}
        onClose={() => setDrawerRep(null)}
        onOverride={(rep) => {
          if (openRun) pushAudit(openRun.id, "Payout method overridden", `${rep.name} → Bank transfer`);
          toast.success("Method overridden", { description: `${rep.name} will be paid 100% to bank.` });
        }}
      />

      {/* Reject dialog */}
      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject / hold run</DialogTitle>
            <DialogDescription>
              A comment is mandatory — it is written to the activity log and shown to whoever submitted the run.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. NSV base data mismatch for the West region"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>
              Cancel
            </Button>
            <Button disabled={!rejectReason.trim()} onClick={submitReject}>
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve dispute */}
      <Dialog open={!!resolveFor} onOpenChange={(o) => !o && setResolveFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve dispute</DialogTitle>
            <DialogDescription>Record the outcome shared with the rep.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="e.g. Invoice corrected, ₹4,500 added to Aug cycle"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={!resolveNote.trim()}
              onClick={() => {
                setDisputes((ds) =>
                  ds.map((d) =>
                    d.id === resolveFor ? { ...d, status: "Resolved", resolutionNote: resolveNote } : d
                  )
                );
                toast.success(`${resolveFor} resolved`);
                setResolveFor(null);
                setResolveNote("");
              }}
            >
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewRunDialog
        open={showNewRun}
        onOpenChange={setShowNewRun}
        onCreate={(programme, period) => {
          const id = `PR-${period.split(" ")[1]}-${String(runs.length + 1).padStart(3, "0")}`;
          const reps = makeReps(runs.length + 2);
          setRuns((rs) => [
            {
              id,
              programme,
              period,
              month: 8,
              year: 2026,
              totalReps: reps.length,
              totalAmount: reps.reduce((s, r) => s + r.net, 0),
              status: "Calculated",
              createdAt: new Date().toISOString().slice(0, 10),
              approvals: [
                { level: "Step 1 — Sales Ops", approver: "Ananya Rao", state: "Pending" },
                { level: "Step 2 — Finance", approver: "Sanjay Mehta", state: "Pending" },
              ],
              audit: [{ at: now(), actor: "Kushagra", action: "Run calculated", detail: `${reps.length} reps` }],
              reps,
            },
            ...rs,
          ]);
          toast.success(`${id} calculated`, { description: "Send it for Sales Ops approval when ready." });
        }}
      />

      <RaiseDisputeDialog
        open={showRaiseDispute}
        onOpenChange={setShowRaiseDispute}
        runs={runs}
        onCreate={(d) => {
          setDisputes((ds) => [{ ...d, id: `DSP-${String(ds.length + 1).padStart(3, "0")}` }, ...ds]);
          toast.success("Dispute logged");
        }}
      />

      <AddClawbackDialog
        open={showAddClawback}
        onOpenChange={setShowAddClawback}
        runs={runs}
        onCreate={(c) => {
          setClawbacks((cs) => [{ ...c, id: `CB-${String(cs.length + 1).padStart(3, "0")}` }, ...cs]);
          toast.success("Recovery scheduled");
        }}
      />
    </div>
  );
}

// ── Lifecycle legend ────────────────────────────────────────────────────────
function LifecycleLegend() {
  const steps = [
    "Draft",
    "Calculated",
    "Awaiting Sales Ops",
    "Awaiting Finance",
    "Approved",
    "Processing",
    "Paid",
    "Closed",
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-2">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Stages
      </span>
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <StatusPill status={s} />
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </span>
      ))}
      <span className="ml-2 text-[10px] text-muted-foreground">
        Any payment error moves the run to <b>Partially failed</b> until retried.
      </span>
    </div>
  );
}

// ── History ─────────────────────────────────────────────────────────────────
function HistoryView({ runs, onOpen }: { runs: PayoutRun[]; onOpen: (id: string) => void }) {
  const [period, setPeriod] = useState("all");
  const done = runs.filter((r) => r.status === "Paid" || r.status === "Closed");
  const periods = Array.from(new Set(done.map((r) => r.period)));
  const filtered = done.filter((r) => period === "all" || r.period === period);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
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
        <span className="text-xs text-muted-foreground">
          {filtered.length} settled runs · {fmt(filtered.reduce((s, r) => s + r.totalAmount, 0))} paid out
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[150px]" />
            <col />
            <col className="w-[100px]" />
            <col className="w-[80px]" />
            <col className="w-[130px]" />
            <col className="w-[200px]" />
            <col className="w-[120px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-semibold">Run ID</th>
              <th className="px-3 py-2.5 text-left font-semibold">Programme</th>
              <th className="px-3 py-2.5 text-left font-semibold">Period</th>
              <th className="px-3 py-2.5 text-right font-semibold">Reps</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-3 py-2.5 text-left font-semibold">Bank reference</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <button
                    onClick={() => onOpen(r.id)}
                    className="font-mono text-xs font-semibold text-primary hover:underline"
                  >
                    {r.id}
                  </button>
                </td>
                <td className="truncate px-3 py-3 text-xs">{r.programme}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{r.period}</td>
                <td className="px-3 py-3 text-right text-xs tabular-nums">{r.totalReps}</td>
                <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums">{fmt(r.totalAmount)}</td>
                <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{r.utr ?? "—"}</td>
                <td className="px-3 py-3">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No settled runs for this period yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Dialogs ─────────────────────────────────────────────────────────────────
function NewRunDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (programme: string, period: string) => void;
}) {
  const [programme, setProgramme] = useState("Urban MR — Monthly Q2");
  const [period, setPeriod] = useState("Aug 2026");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New payout run</DialogTitle>
          <DialogDescription>
            Calculates rep-level payouts from locked attainment data for the selected period.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Programme</Label>
            <Select value={programme} onValueChange={setProgramme}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INITIAL_POLICIES.map((p) => (
                  <SelectItem key={p.programme} value={p.programme}>
                    {p.programme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Jun 2026", "Jul 2026", "Aug 2026"].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onCreate(programme, period);
              onOpenChange(false);
            }}
          >
            Calculate run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RaiseDisputeDialog({
  open,
  onOpenChange,
  runs,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  runs: PayoutRun[];
  onCreate: (d: Omit<Dispute, "id">) => void;
}) {
  const [rep, setRep] = useState("");
  const [runId, setRunId] = useState(runs[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const run = runs.find((r) => r.id === runId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise dispute</DialogTitle>
          <DialogDescription>Log a payout query on behalf of a rep.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Payout run</Label>
            <Select value={runId} onValueChange={setRunId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {runs.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.id} · {r.programme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rep</Label>
            <Select value={rep} onValueChange={setRep}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select rep" />
              </SelectTrigger>
              <SelectContent>
                {(run?.reps ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {r.name} · {r.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Disputed amount (₹)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
              placeholder="4500"
            />
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!rep || !amount || !reason.trim()}
            onClick={() => {
              onCreate({
                rep,
                runId,
                programme: run?.programme ?? "",
                period: run?.period ?? "",
                amount: Number(amount),
                reason,
                raisedOn: new Date().toISOString().slice(0, 10),
                ageDays: 0,
                status: "Open",
              });
              onOpenChange(false);
              setRep("");
              setAmount("");
              setReason("");
            }}
          >
            Log dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddClawbackDialog({
  open,
  onOpenChange,
  runs,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  runs: PayoutRun[];
  onCreate: (c: Omit<Clawback, "id">) => void;
}) {
  const [rep, setRep] = useState("");
  const [runId, setRunId] = useState(runs[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<Clawback["reason"]>("Return");
  const run = runs.find((r) => r.id === runId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add recovery</DialogTitle>
          <DialogDescription>Recover an over-paid incentive in an upcoming cycle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Original run</Label>
            <Select value={runId} onValueChange={setRunId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {runs.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.id} · {r.programme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rep</Label>
            <Select value={rep} onValueChange={setRep}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select rep" />
              </SelectTrigger>
              <SelectContent>
                {(run?.reps ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {r.name} · {r.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as Clawback["reason"])}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Sale reversal", "Return", "Bounced cheque", "Overpayment"] as const).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!rep || !amount}
            onClick={() => {
              onCreate({
                rep,
                originalRunId: runId,
                amount: Number(amount),
                recovered: 0,
                reason,
                nextCycle: "Sep 2026",
                status: "Scheduled",
              });
              onOpenChange(false);
              setRep("");
              setAmount("");
            }}
          >
            Schedule recovery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
