import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MethodPill } from "./PayoutBits";
import {
  fmt,
  METHOD_HEX,
  METHOD_LABEL,
  type PayoutRun,
  type RepPayout,
  type Redemption,
  type Dispute,
} from "./payoutData";

interface Props {
  rep: RepPayout | null;
  runs: PayoutRun[];
  redemptions: Redemption[];
  disputes: Dispute[];
  onClose: () => void;
  onOverride: (rep: RepPayout) => void;
}

export function RepPayoutDrawer({ rep, runs, redemptions, disputes, onClose, onOverride }: Props) {
  if (!rep) return null;

  const history = runs
    .map((run) => ({ run, entry: run.reps.find((r) => r.name === rep.name) }))
    .filter((x) => x.entry);
  const repRedemptions = redemptions.filter((r) => r.rep === rep.name);
  const repDisputes = disputes.filter((d) => d.rep === rep.name);
  const lifetime = history.reduce((s, h) => s + (h.entry?.net ?? 0), 0);

  return (
    <Sheet open={!!rep} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">{rep.name}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {rep.code} · {rep.role} · {rep.division} · {rep.region}
          </p>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Lifetime paid", fmt(lifetime), "bg-teal-50 text-teal-800"],
            ["Runs", String(history.length), "bg-violet-50 text-violet-800"],
            ["Open disputes", String(repDisputes.filter((d) => d.status !== "Resolved").length), "bg-amber-50 text-amber-800"],
          ].map(([l, v, tone]) => (
            <div key={l} className={cn("rounded-2xl border border-border/60 p-3", tone)}>
              <div className="text-[10px] uppercase tracking-wide opacity-70">{l}</div>
              <div className="mt-0.5 text-base font-bold tabular-nums">{v}</div>
            </div>
          ))}
        </div>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">Payout method preference</h3>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onOverride(rep)}>
              Override
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {rep.split.map((s) => (
                <div key={s.method} style={{ width: `${s.pct}%`, backgroundColor: METHOD_HEX[s.method] }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              {rep.split.map((s) => (
                <div key={s.method} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: METHOD_HEX[s.method] }} />
                  <span className="text-muted-foreground">{METHOD_LABEL[s.method]}</span>
                  <span className="font-semibold">{s.pct}%</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Chosen by the rep in-app, within the programme's allowed methods and limits.
            </p>
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Payout history</h3>
          <div className="space-y-1.5">
            {history.map(({ run, entry }) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2"
              >
                <div>
                  <div className="font-mono text-[11px] font-semibold text-foreground">{run.id}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {run.programme} · {run.period}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MethodPill method={entry!.method} />
                  <span className="text-xs font-semibold tabular-nums">{fmt(entry!.net)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Redemptions</h3>
          {repRedemptions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No reward redemptions yet.</p>
          ) : (
            <div className="space-y-1.5">
              {repRedemptions.map((rd) => (
                <div
                  key={rd.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-[11px]"
                >
                  <span className="font-medium text-foreground">{rd.brand}</span>
                  <span className="font-mono text-muted-foreground">{rd.code}</span>
                  <span className="text-muted-foreground">{rd.status}</span>
                  <span className="font-semibold tabular-nums">{fmt(rd.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 mb-6">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Disputes raised</h3>
          {repDisputes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No disputes on record.</p>
          ) : (
            <div className="space-y-1.5">
              {repDisputes.map((d) => (
                <div key={d.id} className="rounded-xl border border-border bg-card px-3 py-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-semibold">{d.id}</span>
                    <span className="text-muted-foreground">{d.status}</span>
                    <span className="font-semibold tabular-nums">{fmt(d.amount)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{d.reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
