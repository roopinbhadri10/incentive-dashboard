import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Users,
  IndianRupee,
  Target,
  TrendingUp,
  CheckCircle2,
  Trophy,
  Rocket,
  Wallet,
  Flag,
  Activity,
} from "lucide-react";
import { mockProgrammes } from "@/data/mockData";
import type { Programme } from "@/types/programme";
import { cn } from "@/lib/utils";

/* ─── helpers ─────────────────────────────────────────────────────── */

const inr = (n: number) =>
  n >= 10_000_000
    ? `₹${(n / 10_000_000).toFixed(2)}Cr`
    : n >= 100_000
    ? `₹${(n / 100_000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}K`
    : `₹${n}`;

// Deterministic pseudo-random from a string seed → [0, 1)
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KPI_LABELS: Record<string, string> = {
  A_nsv: "Net Sales Value",
  B_phasing: "Sales Phasing",
  C_eco: "Effective Coverage",
  D_tlsd: "TLSD",
  E_dbb: "Must-sell Brand Billing",
  F_cft: "Field Time Compliance",
  G_subDbBilling: "Sub-DB Billing",
  H_msb: "Must-Sell SKUs",
  I_channelFocus: "Channel Focus",
  J_teamEarning: "Team Earning",
  K_appUsage: "App Usage",
  L_quarterly: "Quarterly Bonus",
};

const KPI_UNITS: Record<string, { target: string; actual: (v: number) => string }> = {
  A_nsv: { target: "100% of plan", actual: (v) => `${v}% of plan` },
  B_phasing: { target: "≥75% by phase", actual: (v) => `${v}%` },
  C_eco: { target: "100% outlets", actual: (v) => `${v}%` },
  D_tlsd: { target: "Per-line target", actual: (v) => `${v}%` },
  E_dbb: { target: "Trigger ≥100%", actual: (v) => `${v}%` },
  F_cft: { target: "100% compliance", actual: (v) => `${v}%` },
};

const STATUS_PILL: Record<Programme["status"], string> = {
  active: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  draft: "bg-muted text-muted-foreground border-border",
  locked: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  archived: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<Programme["status"], string> = {
  active: "Live",
  draft: "Draft",
  locked: "Locked",
  archived: "Ended",
};

/* ─── synthetic analytics derivation ──────────────────────────────── */

function buildAnalytics(p: Programme) {
  const rng = seeded(p.id);
  const participants = 80 + Math.floor(rng() * 320);
  const avgAtt = 58 + Math.floor(rng() * 42); // 58–99
  const totalPayout = Math.round(participants * (1200 + rng() * 3800));
  const incrementalSales = Math.round(totalPayout * (2.4 + rng() * 2.6));
  const roi = +(incrementalSales / Math.max(1, totalPayout)).toFixed(1);

  // 8-week trend ramping toward avgAtt
  const trend = Array.from({ length: 8 }, (_, i) => {
    const base = 40 + (avgAtt - 40) * ((i + 1) / 8);
    return Math.round(base + (rng() - 0.5) * 8);
  });

  // Leaderboard — top 10
  const names = [
    "Rajesh Kumar", "Priya Sharma", "Amit Patel", "Sneha Reddy", "Vikram Singh",
    "Anjali Mehta", "Karthik Iyer", "Ravi Desai", "Pooja Nair", "Suresh Rao",
  ];
  const leaderboard = names
    .map((name) => {
      const att = Math.min(165, avgAtt + 10 + Math.floor(rng() * 55));
      const earned = Math.round((att / 100) * (4000 + rng() * 6000));
      return { name, attainment: att, earned };
    })
    .sort((a, b) => b.attainment - a.attainment);

  // KPI breakdown from configured kpis
  const kpiEntries = Object.entries(p.kpis).filter(([, v]) => v?.enabled);
  const kpiBreakdown = kpiEntries.map(([key]) => {
    const achieved = 50 + Math.floor(rng() * 70); // 50–119
    const units = KPI_UNITS[key] ?? {
      target: "100% of target",
      actual: (v: number) => `${v}%`,
    };
    return {
      key,
      label: KPI_LABELS[key] ?? key,
      target: units.target,
      actual: units.actual(achieved),
      achieved,
    };
  });

  // Activity log
  const periodLabel = monthYear(p.period.month, p.period.year);
  const log = [
    { icon: Rocket, label: "Program launched", when: `01 ${periodLabel}`, tone: "primary" as const },
    {
      icon: Flag,
      label: `Week 2 milestone hit — ${trend[1]}% avg attainment`,
      when: `14 ${periodLabel}`,
      tone: "info" as const,
    },
    {
      icon: CheckCircle2,
      label: `${Math.round(participants * 0.42)} participants crossed 80% achievement`,
      when: `21 ${periodLabel}`,
      tone: "success" as const,
    },
    {
      icon: Wallet,
      label: `Interim payout processed — ${inr(Math.round(totalPayout * 0.35))}`,
      when: `28 ${periodLabel}`,
      tone: "warning" as const,
    },
    {
      icon: Trophy,
      label: `Top performer: ${leaderboard[0].name} at ${leaderboard[0].attainment}%`,
      when: `02 ${nextMonth(p.period.month, p.period.year)}`,
      tone: "success" as const,
    },
  ];

  return {
    participants,
    avgAtt,
    totalPayout,
    incrementalSales,
    roi,
    trend,
    leaderboard,
    kpiBreakdown,
    log,
  };
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const monthYear = (m: number, y: number) => `${MONTHS[m - 1]} ${y}`;
const nextMonth = (m: number, y: number) =>
  m === 12 ? monthYear(1, y + 1) : monthYear(m + 1, y);

/* ─── trend chart ─────────────────────────────────────────────────── */

function TrendChart({ values }: { values: number[] }) {
  const w = 900;
  const h = 220;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const xAt = (i: number) => padL + (i / (values.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - ((v - min) / (max - min || 1)) * innerH;

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(v)}`).join(" ");
  const area = `${path} L${xAt(values.length - 1)},${padT + innerH} L${xAt(0)},${padT + innerH} Z`;

  const gridLines = [0, 25, 50, 75, 100].filter((v) => v >= min && v <= max);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]">
      <defs>
        <linearGradient id="prog-trend-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={w - padR}
            y1={yAt(v)}
            y2={yAt(v)}
            stroke="hsl(var(--border))"
            strokeDasharray="3 3"
          />
          <text x={8} y={yAt(v) + 4} className="fill-muted-foreground" fontSize="10">
            {v}%
          </text>
        </g>
      ))}
      <path d={area} fill="url(#prog-trend-grad)" />
      <path d={path} stroke="hsl(var(--primary))" strokeWidth={2} fill="none" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={xAt(i)} cy={yAt(v)} r={3} fill="hsl(var(--primary))" />
          <text
            x={xAt(i)}
            y={h - 10}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="10"
          >
            W{i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─── KPI tile ────────────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  intent = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
  hint?: string;
  intent?: "good" | "neutral";
}) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </span>
        <div
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center",
            intent === "good"
              ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon size={14} />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/* ─── page ────────────────────────────────────────────────────────── */

interface Props {
  programmeId: string;
  onBack: () => void;
}

export function ProgramAnalyticsPage({ programmeId, onBack }: Props) {
  const programme = useMemo(
    () => mockProgrammes.find((p) => p.id === programmeId),
    [programmeId],
  );

  const a = useMemo(() => (programme ? buildAnalytics(programme) : null), [programme]);

  if (!programme || !a) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-muted-foreground">Program not found.</p>
        <Button size="sm" variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft size={14} /> Back to programs
        </Button>
      </div>
    );
  }

  const periodLabel = monthYear(programme.period.month, programme.period.year);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onBack}
              className="gap-1 -ml-2 h-7 text-xs text-muted-foreground"
            >
              <ArrowLeft size={14} /> All programs
            </Button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{programme.name}</h1>
              <Badge
                variant="outline"
                className={cn("text-[11px] capitalize", STATUS_PILL[programme.status])}
              >
                {STATUS_LABEL[programme.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {programme.channel} · {programme.role} · {periodLabel} ·{" "}
              {programme.geography.replace(/-/g, " ")}
            </p>
          </div>
        </header>

        {/* Summary bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Total participants"
            value={a.participants.toLocaleString()}
            icon={Users}
            hint={`${programme.role}s enrolled`}
          />
          <MetricCard
            label="Total payouts"
            value={inr(a.totalPayout)}
            icon={IndianRupee}
            hint="Earned to date"
          />
          <MetricCard
            label="Avg achievement"
            value={`${a.avgAtt}%`}
            icon={Target}
            intent={a.avgAtt >= 75 ? "good" : "neutral"}
            hint="Weighted across KPIs"
          />
          <MetricCard
            label="Program ROI"
            value={`${a.roi}x`}
            icon={TrendingUp}
            intent="good"
            hint={`${inr(a.incrementalSales)} incremental sales`}
          />
        </div>

        {/* Trend chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Performance trend</h2>
              <p className="text-[11px] text-muted-foreground">
                Weekly avg achievement across {periodLabel}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {a.trend[a.trend.length - 1]}% latest
            </Badge>
          </div>
          <TrendChart values={a.trend} />
        </Card>

        {/* Leaderboard + KPI breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Top participants</h2>
              <span className="text-[11px] text-muted-foreground">By achievement</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-12">Rank</TableHead>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs text-right">Achievement</TableHead>
                  <TableHead className="text-xs text-right">Payout earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.leaderboard.map((r, i) => (
                  <TableRow key={r.name}>
                    <TableCell>
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold",
                          i === 0 && "bg-[hsl(45,93%,58%)] text-foreground",
                          i === 1 && "bg-[hsl(0,0%,75%)] text-foreground",
                          i === 2 && "bg-[hsl(25,60%,55%)] text-white",
                          i > 2 && "bg-muted text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          r.attainment >= 100
                            ? "text-[hsl(var(--success))]"
                            : r.attainment >= 75
                            ? "text-foreground"
                            : "text-destructive",
                        )}
                      >
                        {r.attainment}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-semibold">
                      {inr(r.earned)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">KPI breakdown</h2>
              <span className="text-[11px] text-muted-foreground">
                {a.kpiBreakdown.length} KPI{a.kpiBreakdown.length === 1 ? "" : "s"} configured
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">KPI</TableHead>
                  <TableHead className="text-xs">Target</TableHead>
                  <TableHead className="text-xs">Actual</TableHead>
                  <TableHead className="text-xs w-32">% Achieved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.kpiBreakdown.map((k) => (
                  <TableRow key={k.key}>
                    <TableCell className="text-sm font-medium">{k.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{k.target}</TableCell>
                    <TableCell className="text-xs text-foreground">{k.actual}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(100, k.achieved)}
                          className="h-1.5 flex-1"
                          indicatorClassName={cn(
                            k.achieved >= 100
                              ? "bg-[hsl(var(--success))]"
                              : k.achieved >= 75
                              ? "bg-[hsl(var(--warning))]"
                              : "bg-destructive",
                          )}
                        />
                        <span className="text-xs font-semibold tabular-nums w-10 text-right">
                          {k.achieved}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {a.kpiBreakdown.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-xs text-muted-foreground py-6"
                    >
                      No KPIs configured for this program.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Activity log */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Activity log</h2>
            </div>
            <span className="text-[11px] text-muted-foreground">Key events</span>
          </div>
          <ol className="relative border-l border-border ml-2 space-y-4">
            {a.log.map((e, i) => {
              const Icon = e.icon;
              const toneCls =
                e.tone === "success"
                  ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
                  : e.tone === "warning"
                  ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
                  : e.tone === "info"
                  ? "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]"
                  : "bg-primary/15 text-primary";
              return (
                <li key={i} className="ml-4">
                  <span
                    className={cn(
                      "absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-background",
                      toneCls,
                    )}
                  >
                    <Icon size={12} />
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-foreground">{e.label}</p>
                    <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                      {e.when}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </div>
  );
}
