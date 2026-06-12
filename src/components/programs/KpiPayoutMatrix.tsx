import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ProgramKPI } from "@/data/mockData";

interface KpiPayoutMatrixProps {
  kpis: ProgramKPI[];
  /** Show the rolled-up program-level totals row at the bottom. */
  showTotals?: boolean;
  /** Compact density for in-card use. */
  compact?: boolean;
  /** Optional override for currency formatting. */
  currency?: string;
}

/**
 * Renders the KPI × Tier payout breakdown.
 * Rows: KPIs. Columns: attainment tiers (derived from union of all KPI tiers).
 * Cells: payout per rep at that KPI/tier intersection.
 */
export function KpiPayoutMatrix({
  kpis,
  showTotals = true,
  compact = false,
  currency = "₹",
}: KpiPayoutMatrixProps) {
  // Derive the canonical tier columns from the union of all KPI tiers.
  const tierColumns = useMemo(() => {
    const seen = new Map<string, { label: string; min: number; max: number }>();
    kpis.forEach(k =>
      k.payoutTiers.forEach(t => {
        if (!seen.has(t.label)) {
          seen.set(t.label, { label: t.label, min: t.minAttainment, max: t.maxAttainment });
        }
      }),
    );
    return Array.from(seen.values());
  }, [kpis]);

  const totalsByTier = useMemo(
    () =>
      tierColumns.map(col =>
        kpis.reduce(
          (sum, k) => sum + (k.payoutTiers.find(t => t.label === col.label)?.payoutPerRep ?? 0),
          0,
        ),
      ),
    [kpis, tierColumns],
  );

  // Find the highest payout per KPI row to highlight the "stretch" cell.
  const maxByKpi = useMemo(
    () =>
      kpis.map(k => Math.max(...k.payoutTiers.map(t => t.payoutPerRep), 0)),
    [kpis],
  );

  if (kpis.length === 0 || tierColumns.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No KPI payout structure defined.</p>
    );
  }

  const cellPad = compact ? "px-3 py-2" : "px-4 py-2.5";
  const headPad = compact ? "px-3 py-2.5" : "px-4 py-3";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gradient-to-b from-muted/60 to-muted/30 border-b border-border">
              <th
                className={cn(
                  "text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]",
                  headPad,
                )}
              >
                KPI
              </th>
              <th
                className={cn(
                  "text-right font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-16",
                  headPad,
                )}
              >
                Weight
              </th>
              {tierColumns.map((col, i) => (
                <th
                  key={col.label}
                  className={cn(
                    "text-center font-semibold text-foreground border-l border-border/70",
                    headPad,
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                        i === 0 && "bg-muted text-muted-foreground",
                        i === 1 && "bg-primary/10 text-primary",
                        i >= 2 && "bg-primary/20 text-primary",
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          i === 0 && "bg-muted-foreground/60",
                          i === 1 && "bg-primary",
                          i >= 2 && "bg-primary",
                        )}
                      />
                      {col.label}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                      {col.min}–{col.max}%
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kpis.map((kpi, idx) => (
              <tr
                key={kpi.name}
                className={cn(
                  "border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/20",
                )}
              >
                <td className={cn("align-middle", cellPad)}>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-1 h-8 rounded-full bg-primary/70 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div
                        className="font-semibold text-foreground text-[12px] truncate max-w-[200px]"
                        title={kpi.name}
                      >
                        {kpi.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {kpi.target}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={cn("text-right align-middle", cellPad)}>
                  <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 rounded-md bg-muted/60 text-foreground font-semibold tabular-nums text-[11px]">
                    {kpi.weight}%
                  </span>
                </td>
                {tierColumns.map((col, ti) => {
                  const tier = kpi.payoutTiers.find(t => t.label === col.label);
                  const isMax =
                    tier && maxByKpi[idx] > 0 && tier.payoutPerRep === maxByKpi[idx];
                  return (
                    <td
                      key={col.label}
                      className={cn(
                        "text-center tabular-nums border-l border-border/50 align-middle",
                        cellPad,
                      )}
                    >
                      {tier ? (
                        <span
                          className={cn(
                            "inline-flex items-baseline gap-0.5 font-semibold",
                            isMax
                              ? "text-primary text-[13px]"
                              : "text-foreground text-[12px]",
                          )}
                        >
                          <span className="text-[10px] font-medium opacity-70">
                            {currency}
                          </span>
                          {tier.payoutPerRep.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {showTotals && (
              <tr className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-t-2 border-primary/40">
                <td className={cn("align-middle", cellPad)}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-1 h-8 rounded-full bg-primary shrink-0" aria-hidden />
                    <div>
                      <div className="font-bold text-foreground text-[12px]">
                        Total per rep
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Sum across all KPIs
                      </div>
                    </div>
                  </div>
                </td>
                <td className={cn("text-right align-middle", cellPad)}>
                  <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 rounded-md bg-primary/15 text-primary font-bold tabular-nums text-[11px]">
                    {kpis.reduce((s, k) => s + k.weight, 0)}%
                  </span>
                </td>
                {totalsByTier.map((sum, i) => (
                  <td
                    key={tierColumns[i].label}
                    className={cn(
                      "text-center tabular-nums border-l border-primary/20 align-middle",
                      cellPad,
                    )}
                  >
                    <span className="inline-flex items-baseline gap-0.5 font-bold text-primary text-[13px]">
                      <span className="text-[10px] font-semibold opacity-70">
                        {currency}
                      </span>
                      {sum.toLocaleString()}
                    </span>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
