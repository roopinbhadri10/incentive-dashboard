import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Trophy,
  AlertTriangle,
  Activity,
  Store,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
} from "lucide-react";
import { mockPrograms, regions, channels } from "@/data/mockData";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */
const inr = (n: number) =>
  n >= 10_000_000
    ? `₹${(n / 10_000_000).toFixed(1)}Cr`
    : n >= 100_000
    ? `₹${(n / 100_000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}K`
    : `₹${n}`;

const parseLakh = (s: string) => {
  const m = s.match(/([\d.]+)\s*([CcLlKk]?)/);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  const suf = m[2].toLowerCase();
  if (suf === "cr" || suf === "c") return num * 10_000_000;
  if (suf === "l") return num * 100_000;
  if (suf === "k") return num * 1000;
  return num;
};

const parseAtt = (s: string) => parseInt(s.replace("%", "")) || 0;

/* ---------- KPI tile ---------- */
function MetricTile({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  intent = "neutral",
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
  intent?: "good" | "bad" | "neutral";
  hint?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
        <div
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center",
            intent === "good" && "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
            intent === "bad" && "bg-destructive/10 text-destructive",
            intent === "neutral" && "bg-primary/10 text-primary",
          )}
        >
          <Icon size={14} />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      {delta !== undefined && (
        <div className="flex items-center gap-1 text-[11px]">
          {positive ? (
            <ArrowUpRight size={12} className="text-[hsl(var(--success))]" />
          ) : (
            <ArrowDownRight size={12} className="text-destructive" />
          )}
          <span className={cn("font-semibold", positive ? "text-[hsl(var(--success))]" : "text-destructive")}>
            {positive ? "+" : ""}
            {delta}%
          </span>
          <span className="text-muted-foreground">{deltaLabel ?? "vs last period"}</span>
        </div>
      )}
      {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
    </Card>
  );
}

/* ---------- Attainment trend (sparkline) ---------- */
function AttainmentTrend({ values, color = "hsl(var(--primary))" }: { values: number[]; color?: string }) {
  const w = 220;
  const h = 60;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const path = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id="trend-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trend-grad)" />
      <path d={path} stroke={color} strokeWidth={2} fill="none" />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
        return <circle key={i} cx={x} cy={y} r={i === values.length - 1 ? 3 : 1.5} fill={color} />;
      })}
    </svg>
  );
}

/* ---------- Attainment distribution bell ---------- */
function AttainmentDistribution({ programs }: { programs: typeof mockPrograms }) {
  // Buckets of attainment for participants (synthesized)
  const buckets = [
    { label: "<50%", color: "hsl(var(--destructive))" },
    { label: "50-70%", color: "hsl(var(--warning))" },
    { label: "70-90%", color: "hsl(var(--info))" },
    { label: "90-110%", color: "hsl(var(--success))" },
    { label: ">110%", color: "hsl(var(--primary))" },
  ];
  // Synthesize a bell-ish distribution centered on the mean attainment
  const mean = programs.reduce((s, p) => s + parseAtt(p.attainmentRate) * p.participants, 0) /
    programs.reduce((s, p) => s + p.participants, 0);
  const totalReps = programs.reduce((s, p) => s + p.participants, 0);
  const weights = [10, 22, 35, 24, 9].map((w, i) => {
    // Shift weight toward mean bucket
    const center = [40, 60, 80, 100, 120][i];
    const dist = Math.abs(center - mean);
    return Math.max(2, w - dist * 0.3);
  });
  const sumW = weights.reduce((s, w) => s + w, 0);
  const counts = weights.map((w) => Math.round((w / sumW) * totalReps));
  const max = Math.max(...counts);

  return (
    <div className="flex items-end gap-3 h-40 pt-2">
      {buckets.map((b, i) => (
        <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
          <span className="text-[10px] font-semibold tabular-nums text-foreground">{counts[i]}</span>
          <div className="w-full flex-1 bg-muted/40 rounded-t-md relative overflow-hidden flex items-end">
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: `${(counts[i] / max) * 100}%`, backgroundColor: b.color }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground text-center">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- KPI heatmap ---------- */
function KpiHeatmap({ programs }: { programs: typeof mockPrograms }) {
  // Aggregate KPI attainment across all programs
  const kpiAgg = new Map<string, { sum: number; count: number; weight: number }>();
  programs.forEach((p) => {
    p.kpis.forEach((k) => {
      const cur = kpiAgg.get(k.name) || { sum: 0, count: 0, weight: 0 };
      cur.sum += k.attainment;
      cur.count += 1;
      cur.weight += k.weight;
      kpiAgg.set(k.name, cur);
    });
  });
  const rows = [...kpiAgg.entries()]
    .map(([name, v]) => ({
      name,
      avg: Math.round(v.sum / v.count),
      programs: v.count,
      avgWeight: Math.round(v.weight / v.count),
    }))
    .sort((a, b) => b.avg - a.avg);

  const heatColor = (v: number) =>
    v >= 80
      ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30"
      : v >= 65
      ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30"
      : v >= 50
      ? "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border-[hsl(var(--info))]/30"
      : "bg-destructive/15 text-destructive border-destructive/30";

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{r.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {r.programs} program{r.programs > 1 ? "s" : ""} · avg weight {r.avgWeight}%
            </p>
          </div>
          <div className="w-40">
            <Progress
              value={r.avg}
              className="h-2"
              indicatorClassName={cn(
                r.avg >= 80
                  ? "bg-[hsl(var(--success))]"
                  : r.avg >= 65
                  ? "bg-[hsl(var(--warning))]"
                  : r.avg >= 50
                  ? "bg-[hsl(var(--info))]"
                  : "bg-destructive",
              )}
            />
          </div>
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded border tabular-nums w-12 text-center",
              heatColor(r.avg),
            )}
          >
            {r.avg}%
          </span>
          <span className="text-[10px] text-muted-foreground w-16 text-right">
            {r.avg >= 80 ? "On track" : r.avg >= 65 ? "Watch" : r.avg >= 50 ? "Lagging" : "Critical"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Region/Channel breakdown ---------- */
function BreakdownTable({
  programs,
  groupBy,
}: {
  programs: typeof mockPrograms;
  groupBy: "region" | "channel";
}) {
  const map = new Map<string, { att: number; reps: number; outlets: number; payout: number; sales: number; count: number }>();
  programs.forEach((p) => {
    const key = p[groupBy];
    const cur = map.get(key) || { att: 0, reps: 0, outlets: 0, payout: 0, sales: 0, count: 0 };
    cur.att += parseAtt(p.attainmentRate);
    cur.reps += p.participants;
    cur.outlets += p.outletReach;
    cur.payout += parseLakh(p.totalPayout);
    cur.sales += parseLakh(p.incrementalSales);
    cur.count += 1;
    map.set(key, cur);
  });
  const rows = [...map.entries()]
    .map(([k, v]) => ({
      key: k,
      avgAtt: Math.round(v.att / v.count),
      reps: v.reps,
      outlets: v.outlets,
      payout: v.payout,
      sales: v.sales,
      programs: v.count,
    }))
    .sort((a, b) => b.avgAtt - a.avgAtt);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">{groupBy === "region" ? "Region" : "Division"}</TableHead>
          <TableHead className="text-xs text-center">Programs</TableHead>
          <TableHead className="text-xs text-center">Reps</TableHead>
          <TableHead className="text-xs text-center">Outlets</TableHead>
          <TableHead className="text-xs">Avg attainment</TableHead>
          <TableHead className="text-xs text-right">Incremental sales</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key}>
            <TableCell className="font-medium text-sm">{r.key}</TableCell>
            <TableCell className="text-center text-sm tabular-nums">{r.programs}</TableCell>
            <TableCell className="text-center text-sm tabular-nums">{r.reps}</TableCell>
            <TableCell className="text-center text-sm tabular-nums">{r.outlets.toLocaleString()}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress
                  value={r.avgAtt}
                  className="h-1.5 w-24"
                  indicatorClassName={cn(
                    r.avgAtt >= 80 ? "bg-[hsl(var(--success))]" : r.avgAtt >= 60 ? "bg-[hsl(var(--warning))]" : "bg-destructive",
                  )}
                />
                <span className="text-xs font-semibold tabular-nums w-10">{r.avgAtt}%</span>
              </div>
            </TableCell>
            <TableCell className="text-right text-sm font-semibold tabular-nums">{inr(r.sales)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ---------- Leaderboard ---------- */
const repNames = [
  "Rajesh Kumar", "Priya Sharma", "Amit Patel", "Sneha Reddy", "Vikram Singh",
  "Anjali Mehta", "Karthik Iyer", "Ravi Desai", "Pooja Nair", "Suresh Rao",
];
function Leaderboard({ programs, mode }: { programs: typeof mockPrograms; mode: "top" | "bottom" }) {
  const reps = repNames.map((name, i) => {
    const prog = programs[i % programs.length];
    const baseAtt = parseAtt(prog.attainmentRate);
    const att = mode === "top" ? Math.min(165, baseAtt + 30 + (i % 3) * 8) : Math.max(15, baseAtt - 25 - (i % 3) * 6);
    const earnings = Math.round((att / 100) * (8000 + (i % 4) * 1500));
    return {
      name,
      program: prog.name,
      region: prog.region,
      attainment: att,
      earnings,
      outlets: 40 + (i * 7) % 60,
    };
  })
    .sort((a, b) => (mode === "top" ? b.attainment - a.attainment : a.attainment - b.attainment))
    .slice(0, 5);

  return (
    <div className="space-y-2">
      {reps.map((r, i) => (
        <div
          key={r.name}
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
        >
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
              i === 0 && mode === "top" && "bg-[hsl(45,93%,58%)] text-foreground",
              i === 1 && mode === "top" && "bg-[hsl(0,0%,75%)] text-foreground",
              i === 2 && mode === "top" && "bg-[hsl(25,60%,55%)] text-white",
              (i > 2 || mode === "bottom") && "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {r.region} · {r.outlets} outlets
            </p>
          </div>
          <div className="text-right shrink-0">
            <p
              className={cn(
                "text-sm font-bold tabular-nums",
                r.attainment >= 100 ? "text-[hsl(var(--success))]" : r.attainment >= 70 ? "text-foreground" : "text-destructive",
              )}
            >
              {r.attainment}%
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums">{inr(r.earnings)} earned</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Page ---------- */
export function PerformancePage() {
  const [regionFilter, setRegionFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("current");

  const filtered = useMemo(
    () =>
      mockPrograms.filter(
        (p) =>
          (regionFilter === "all" || p.region === regionFilter) &&
          (channelFilter === "all" || p.channel === channelFilter),
      ),
    [regionFilter, channelFilter],
  );

  const totals = useMemo(() => {
    const totalReps = filtered.reduce((s, p) => s + p.participants, 0);
    const totalOutlets = filtered.reduce((s, p) => s + p.outletReach, 0);
    const avgAtt = Math.round(
      filtered.reduce((s, p) => s + parseAtt(p.attainmentRate) * p.participants, 0) / Math.max(1, totalReps),
    );
    const totalPayout = filtered.reduce((s, p) => s + parseLakh(p.totalPayout), 0);
    const incrementalSales = filtered.reduce((s, p) => s + parseLakh(p.incrementalSales), 0);
    const onTrack = filtered.filter((p) => parseAtt(p.attainmentRate) >= 70).length;
    const atRisk = filtered.filter((p) => parseAtt(p.attainmentRate) < 60).length;
    return { totalReps, totalOutlets, avgAtt, totalPayout, incrementalSales, onTrack, atRisk };
  }, [filtered]);

  // Mock weekly trend (8 weeks)
  const trend = [54, 58, 61, 63, 66, 64, 68, totals.avgAtt];

  return (
    <div className="flex-1 overflow-y-auto bg-background" data-tour="performance-page">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Performance Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time view of how your incentive programs are tracking — attainment, KPI execution, and rep performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current period</SelectItem>
                <SelectItem value="mtd">Month to date</SelectItem>
                <SelectItem value="qtd">Quarter to date</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="All divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All divisions</SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Insight ribbon */}
        <Card className="p-4 border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Lightbulb size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Insight</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                <strong className="text-foreground">{totals.atRisk} programs are tracking below 60% attainment</strong> — primarily
                driven by weak <strong className="text-foreground">Store Coverage</strong> and{" "}
                <strong className="text-foreground">Display Setup</strong> KPIs in MT West. Consider mid-cycle nudges or KPI
                re-weighting before week 6.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              Updated 2h ago
            </Badge>
          </div>
        </Card>

        {/* Topline metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricTile
            label="Avg attainment"
            value={`${totals.avgAtt}%`}
            delta={6}
            icon={Target}
            intent={totals.avgAtt >= 70 ? "good" : "neutral"}
          />
          <MetricTile
            label="Active reps"
            value={totals.totalReps.toLocaleString()}
            delta={3}
            icon={Users}
            intent="neutral"
          />
          <MetricTile
            label="Outlets covered"
            value={totals.totalOutlets.toLocaleString()}
            delta={8}
            icon={Store}
            intent="neutral"
          />
          <MetricTile label="Programs on track" value={`${totals.onTrack}/${filtered.length}`} icon={CheckCircle2} intent="good" />
          <MetricTile
            label="Programs at risk"
            value={String(totals.atRisk)}
            icon={AlertTriangle}
            intent="bad"
            hint="< 60% attainment"
          />
          <MetricTile
            label="Payout earned"
            value={inr(totals.totalPayout)}
            delta={4}
            icon={Trophy}
            intent="neutral"
            hint="Of allocated budget"
          />
        </div>

        {/* Trend + distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Attainment trend (8 weeks)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Weighted by participant count</p>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-[hsl(var(--success))]" />
                <span className="text-xs font-semibold text-[hsl(var(--success))]">+14 pts vs week 1</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold tabular-nums text-foreground">{totals.avgAtt}%</p>
                <p className="text-[11px] text-muted-foreground">This week</p>
              </div>
              <div className="flex-1 flex justify-end">
                <AttainmentTrend values={trend} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t">
              {[
                { l: "Week 1", v: trend[0] },
                { l: "Week 4", v: trend[3] },
                { l: "Week 6", v: trend[5] },
                { l: "Now", v: trend[7] },
              ].map((w) => (
                <div key={w.l}>
                  <p className="text-[10px] text-muted-foreground">{w.l}</p>
                  <p className="text-sm font-semibold tabular-nums">{w.v}%</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-foreground">Attainment distribution</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Reps grouped by current attainment</p>
            </div>
            <AttainmentDistribution programs={filtered} />
            <p className="text-[10px] text-muted-foreground mt-3 leading-snug">
              <strong className="text-foreground">Healthy curve</strong> shows most reps clustered around target. Bottom-heavy
              suggests targets are too aggressive or coverage gaps.
            </p>
          </Card>
        </div>

        {/* KPI heatmap + breakdown tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="p-5 lg:col-span-3">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">KPI performance heatmap</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Average attainment per KPI across all active programs</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {[...new Set(filtered.flatMap((p) => p.kpis.map((k) => k.name)))].length} unique KPIs
              </Badge>
            </div>
            <KpiHeatmap programs={filtered} />
          </Card>

          <Card className="p-5 lg:col-span-2">
            <Tabs defaultValue="region">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Breakdown</h3>
                <TabsList className="h-8">
                  <TabsTrigger value="region" className="text-xs">
                    Region
                  </TabsTrigger>
                  <TabsTrigger value="channel" className="text-xs">
                    Division
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="region" className="mt-0">
                <BreakdownTable programs={filtered} groupBy="region" />
              </TabsContent>
              <TabsContent value="channel" className="mt-0">
                <BreakdownTable programs={filtered} groupBy="channel" />
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Leaderboards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[hsl(45,93%,58%)]" />
                <h3 className="text-sm font-semibold text-foreground">Top performers</h3>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Earning above target
              </Badge>
            </div>
            <Leaderboard programs={filtered} mode="top" />
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-destructive" />
                <h3 className="text-sm font-semibold text-foreground">Needs attention</h3>
              </div>
              <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                Coaching opportunity
              </Badge>
            </div>
            <Leaderboard programs={filtered} mode="bottom" />
          </Card>
        </div>

        {/* Per-program performance table */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Program-level performance</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Click any row for detailed view</p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {filtered.length} programs
            </Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Program</TableHead>
                <TableHead className="text-xs">Region · Channel</TableHead>
                <TableHead className="text-xs text-center">Reps</TableHead>
                <TableHead className="text-xs">Attainment</TableHead>
                <TableHead className="text-xs text-center">Budget used</TableHead>
                <TableHead className="text-xs text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const att = parseAtt(p.attainmentRate);
                const status =
                  att >= 80 ? { l: "On track", c: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]" } :
                  att >= 60 ? { l: "Watch", c: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]" } :
                  { l: "At risk", c: "bg-destructive/15 text-destructive" };
                return (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{p.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground leading-tight">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.region} · {p.channel}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{p.participants}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={att}
                          className="h-1.5 w-24"
                          indicatorClassName={cn(
                            att >= 80 ? "bg-[hsl(var(--success))]" : att >= 60 ? "bg-[hsl(var(--warning))]" : "bg-destructive",
                          )}
                        />
                        <span className="text-xs font-semibold tabular-nums w-10">{att}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs tabular-nums">{p.budgetUtilized}%</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("inline-block text-[10px] font-semibold px-2 py-0.5 rounded", status.c)}>
                        {status.l}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
