import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp,
  IndianRupee,
  Wallet,
  Gauge,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Zap,
} from "lucide-react";
import { mockPrograms, regions } from "@/data/mockData";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */
const inr = (n: number) =>
  n >= 10_000_000
    ? `₹${(n / 10_000_000).toFixed(1)}Cr`
    : n >= 100_000
    ? `₹${(n / 100_000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}K`
    : `₹${Math.round(n)}`;

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
const parseRoi = (s: string) => parseFloat(s.replace("x", "")) || 0;
const parseAtt = (s: string) => parseInt(s.replace("%", "")) || 0;

/* ---------- Metric tile ---------- */
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

/* ---------- ROI vs payout scatter ---------- */
function RoiScatter({ programs }: { programs: typeof mockPrograms }) {
  const w = 540;
  const h = 260;
  const padX = 40;
  const padY = 30;
  const points = programs.map((p) => ({
    x: parseLakh(p.totalPayout),
    y: parseRoi(p.roi),
    r: Math.max(6, Math.min(22, p.participants / 18)),
    program: p,
  }));
  const maxX = Math.max(...points.map((p) => p.x)) * 1.1;
  const maxY = Math.max(...points.map((p) => p.y), 6);

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={w - 10}
            y1={padY + t * (h - padY * 2)}
            y2={padY + t * (h - padY * 2)}
            stroke="hsl(var(--border))"
            strokeDasharray="2 3"
          />
        ))}
        {/* Y axis labels (ROI) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text
            key={t}
            x={padX - 8}
            y={padY + (1 - t) * (h - padY * 2) + 3}
            textAnchor="end"
            fontSize="9"
            fill="hsl(var(--muted-foreground))"
          >
            {(t * maxY).toFixed(1)}x
          </text>
        ))}
        {/* X axis labels (payout) */}
        {[0, 0.5, 1].map((t) => (
          <text
            key={t}
            x={padX + t * (w - padX - 10)}
            y={h - 8}
            textAnchor="middle"
            fontSize="9"
            fill="hsl(var(--muted-foreground))"
          >
            {inr(t * maxX)}
          </text>
        ))}
        {/* Break-even line at ROI = 1 */}
        <line
          x1={padX}
          x2={w - 10}
          y1={padY + (1 - 1 / maxY) * (h - padY * 2)}
          y2={padY + (1 - 1 / maxY) * (h - padY * 2)}
          stroke="hsl(var(--destructive))"
          strokeDasharray="4 3"
          strokeWidth="1.5"
        />
        <text
          x={w - 14}
          y={padY + (1 - 1 / maxY) * (h - padY * 2) - 4}
          textAnchor="end"
          fontSize="9"
          fill="hsl(var(--destructive))"
          fontWeight="600"
        >
          Break-even (1.0x)
        </text>
        {/* Bubbles */}
        {points.map((p, i) => {
          const cx = padX + (p.x / maxX) * (w - padX - 10);
          const cy = padY + (1 - p.y / maxY) * (h - padY * 2);
          const color =
            p.y >= 3
              ? "hsl(var(--success))"
              : p.y >= 1.5
              ? "hsl(var(--primary))"
              : p.y >= 1
              ? "hsl(var(--warning))"
              : "hsl(var(--destructive))";
          return (
            <g key={p.program.id}>
              <circle cx={cx} cy={cy} r={p.r} fill={color} fillOpacity={0.25} stroke={color} strokeWidth="1.5">
                <title>
                  {p.program.name} · ROI {p.y}x · Payout {inr(p.x)}
                </title>
              </circle>
              <text x={cx} y={cy + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill="hsl(var(--foreground))">
                {p.program.code.replace("INC_", "")}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 px-10">
        <span>Total payout →</span>
        <span>Bubble size = participant count</span>
      </div>
    </div>
  );
}

/* ---------- Budget burn ---------- */
function BudgetBurn({ programs }: { programs: typeof mockPrograms }) {
  return (
    <div className="space-y-3">
      {programs.slice(0, 6).map((p) => {
        const used = p.budgetUtilized;
        const allocated = parseLakh(p.allocatedBudget);
        const usedAmt = (allocated * used) / 100;
        const intent = used > 90 ? "destructive" : used > 75 ? "warning" : "success";
        return (
          <div key={p.id}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{p.icon}</span>
                <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold tabular-nums">
                  {inr(usedAmt)} <span className="text-muted-foreground font-normal">/ {p.allocatedBudget}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={used}
                className="h-1.5 flex-1"
                indicatorClassName={cn(
                  intent === "destructive" && "bg-destructive",
                  intent === "warning" && "bg-[hsl(var(--warning))]",
                  intent === "success" && "bg-[hsl(var(--success))]",
                )}
              />
              <span className="text-[10px] font-semibold tabular-nums w-9 text-right">{used}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- ROI ranking table ---------- */
function RoiRanking({ programs }: { programs: typeof mockPrograms }) {
  const rows = [...programs]
    .map((p) => {
      const sales = parseLakh(p.incrementalSales);
      const payout = parseLakh(p.totalPayout);
      const roi = parseRoi(p.roi);
      const costPerCase = payout / Math.max(1, sales / 100); // synthetic
      return {
        program: p,
        sales,
        payout,
        roi,
        net: sales - payout,
        costPerRep: payout / Math.max(1, p.participants),
        costPerOutlet: payout / Math.max(1, p.outletReach),
      };
    })
    .sort((a, b) => b.roi - a.roi);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Program</TableHead>
          <TableHead className="text-xs text-right">Payout</TableHead>
          <TableHead className="text-xs text-right">Incremental sales</TableHead>
          <TableHead className="text-xs text-right">Net gain</TableHead>
          <TableHead className="text-xs text-right">Cost / rep</TableHead>
          <TableHead className="text-xs text-right">Cost / outlet</TableHead>
          <TableHead className="text-xs text-right">ROI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const roiColor =
            r.roi >= 3
              ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
              : r.roi >= 1.5
              ? "bg-primary/15 text-primary"
              : r.roi >= 1
              ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
              : "bg-destructive/15 text-destructive";
          return (
            <TableRow key={r.program.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-base">{r.program.icon}</span>
                  <div>
                    <p className="text-sm font-medium leading-tight">{r.program.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.program.region} · {r.program.channel}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">{inr(r.payout)}</TableCell>
              <TableCell className="text-right text-sm font-semibold tabular-nums">{inr(r.sales)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums text-[hsl(var(--success))] font-semibold">
                +{inr(r.net)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">{inr(r.costPerRep)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{inr(r.costPerOutlet)}</TableCell>
              <TableCell className="text-right">
                <span className={cn("inline-block text-xs font-bold px-2 py-1 rounded tabular-nums", roiColor)}>
                  {r.roi.toFixed(1)}x
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ---------- ROI by region/channel ---------- */
function RoiBreakdown({
  programs,
  groupBy,
}: {
  programs: typeof mockPrograms;
  groupBy: "region" | "channel";
}) {
  const map = new Map<string, { sales: number; payout: number; reps: number; count: number }>();
  programs.forEach((p) => {
    const key = p[groupBy];
    const cur = map.get(key) || { sales: 0, payout: 0, reps: 0, count: 0 };
    cur.sales += parseLakh(p.incrementalSales);
    cur.payout += parseLakh(p.totalPayout);
    cur.reps += p.participants;
    cur.count += 1;
    map.set(key, cur);
  });
  const rows = [...map.entries()]
    .map(([k, v]) => ({
      key: k,
      sales: v.sales,
      payout: v.payout,
      reps: v.reps,
      programs: v.count,
      roi: v.sales / Math.max(1, v.payout),
    }))
    .sort((a, b) => b.roi - a.roi);

  const maxRoi = Math.max(...rows.map((r) => r.roi));

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-foreground">{r.key}</p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{r.programs} programs</span>
              <span>·</span>
              <span>{r.reps} reps</span>
              <span>·</span>
              <span className="font-semibold text-foreground">{inr(r.sales)} sales</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-6 bg-muted/40 rounded relative overflow-hidden">
              <div
                className={cn(
                  "h-full rounded transition-all flex items-center justify-end px-2",
                  r.roi >= 3
                    ? "bg-[hsl(var(--success))]"
                    : r.roi >= 1.5
                    ? "bg-primary"
                    : r.roi >= 1
                    ? "bg-[hsl(var(--warning))]"
                    : "bg-destructive",
                )}
                style={{ width: `${(r.roi / maxRoi) * 100}%` }}
              >
                <span className="text-[10px] font-bold text-white tabular-nums">{r.roi.toFixed(1)}x</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Page ---------- */
export function RoiPage() {
  const [regionFilter, setRegionFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("current");

  const filtered = useMemo(
    () => mockPrograms.filter((p) => regionFilter === "all" || p.region === regionFilter),
    [regionFilter],
  );

  const totals = useMemo(() => {
    const totalPayout = filtered.reduce((s, p) => s + parseLakh(p.totalPayout), 0);
    const totalSales = filtered.reduce((s, p) => s + parseLakh(p.incrementalSales), 0);
    const totalBudget = filtered.reduce((s, p) => s + parseLakh(p.allocatedBudget), 0);
    const blendedRoi = totalSales / Math.max(1, totalPayout);
    const netGain = totalSales - totalPayout;
    const budgetUtilized = (totalPayout / Math.max(1, totalBudget)) * 100;
    const profitablePrograms = filtered.filter((p) => parseRoi(p.roi) >= 1.5).length;
    const unprofitable = filtered.filter((p) => parseRoi(p.roi) < 1).length;
    const avgCostPerRep = totalPayout / filtered.reduce((s, p) => s + p.participants, 0);
    return { totalPayout, totalSales, totalBudget, blendedRoi, netGain, budgetUtilized, profitablePrograms, unprofitable, avgCostPerRep };
  }, [filtered]);

  return (
    <div className="flex-1 overflow-y-auto bg-background" data-tour="roi-page">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ROI Analysis</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Measure incremental sales, payout efficiency, and return on every rupee invested in incentives.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current period</SelectItem>
                <SelectItem value="qtd">Quarter to date</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
                <SelectItem value="rolling12">Rolling 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
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
                Your <strong className="text-foreground">Festive Season Incentive</strong> is delivering a{" "}
                <strong className="text-[hsl(var(--success))]">5.7x ROI</strong> — well above portfolio average. Reallocate
                ~₹3L from <strong className="text-foreground">Summer MT Expansion</strong> (1.4x) to scale festive coverage in
                West & East. Estimated lift: <strong className="text-foreground">+₹17L incremental sales</strong>.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              High confidence
            </Badge>
          </div>
        </Card>

        {/* Topline metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricTile
            label="Blended ROI"
            value={`${totals.blendedRoi.toFixed(1)}x`}
            delta={12}
            icon={Gauge}
            intent={totals.blendedRoi >= 2 ? "good" : totals.blendedRoi >= 1 ? "neutral" : "bad"}
            hint="Sales ÷ payout"
          />
          <MetricTile
            label="Incremental sales"
            value={inr(totals.totalSales)}
            delta={18}
            icon={TrendingUp}
            intent="good"
          />
          <MetricTile label="Total payout" value={inr(totals.totalPayout)} delta={9} icon={IndianRupee} intent="neutral" />
          <MetricTile
            label="Net gain"
            value={inr(totals.netGain)}
            delta={22}
            icon={Wallet}
            intent="good"
            hint="Sales − payout"
          />
          <MetricTile
            label="Budget utilized"
            value={`${Math.round(totals.budgetUtilized)}%`}
            icon={Layers}
            intent={totals.budgetUtilized > 90 ? "bad" : "neutral"}
            hint={`of ${inr(totals.totalBudget)} allocated`}
          />
          <MetricTile
            label="Cost per rep"
            value={inr(totals.avgCostPerRep)}
            delta={-4}
            deltaLabel="more efficient"
            icon={Zap}
            intent="good"
          />
        </div>

        {/* ROI scatter + ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="p-5 lg:col-span-3">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Payout vs ROI</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Top-left = small spend, big return · Bottom-right = high spend, low return
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" /> ≥3x
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" /> 1.5–3x
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--warning))]" /> 1–1.5x
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-destructive" /> &lt;1x
                </div>
              </div>
            </div>
            <RoiScatter programs={filtered} />
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Budget burn</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Live tracking vs allocation</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Burn rate
              </Badge>
            </div>
            <BudgetBurn programs={filtered} />
            <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Programs over 90% spent</span>
              <span className="font-semibold text-destructive">
                {filtered.filter((p) => p.budgetUtilized > 90).length}
              </span>
            </div>
          </Card>
        </div>

        {/* ROI breakdown */}
        <Card className="p-5">
          <Tabs defaultValue="region">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">ROI breakdown</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Where your incentive rupees are working hardest</p>
              </div>
              <TabsList className="h-8">
                <TabsTrigger value="region" className="text-xs">
                  By region
                </TabsTrigger>
                <TabsTrigger value="channel" className="text-xs">
                  By division
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="region" className="mt-0">
              <RoiBreakdown programs={filtered} groupBy="region" />
            </TabsContent>
            <TabsContent value="channel" className="mt-0">
              <RoiBreakdown programs={filtered} groupBy="channel" />
            </TabsContent>
          </Tabs>
        </Card>

        {/* Health summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 border-l-4 border-l-[hsl(var(--success))]">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-[hsl(var(--success))]" />
              <p className="text-sm font-semibold text-foreground">Profitable programs</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-foreground">{totals.profitablePrograms}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ROI ≥ 1.5x — these are pulling their weight. Consider scaling coverage or extending duration.
            </p>
          </Card>
          <Card className="p-5 border-l-4 border-l-[hsl(var(--warning))]">
            <div className="flex items-center gap-2 mb-2">
              <Gauge size={16} className="text-[hsl(var(--warning))]" />
              <p className="text-sm font-semibold text-foreground">Marginal programs</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {filtered.length - totals.profitablePrograms - totals.unprofitable}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ROI 1–1.5x — barely break-even. Re-tune KPI weights or tighten payout tiers.
            </p>
          </Card>
          <Card className="p-5 border-l-4 border-l-destructive">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-destructive" />
              <p className="text-sm font-semibold text-foreground">Unprofitable programs</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-foreground">{totals.unprofitable}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ROI &lt; 1x — payout exceeds incremental lift. Pause, restructure, or sunset these.
            </p>
          </Card>
        </div>

        {/* ROI ranking */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Program ROI ranking</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sorted by return on investment — focus reallocation on top vs bottom
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {filtered.length} programs
            </Badge>
          </div>
          <RoiRanking programs={filtered} />
        </Card>

        {/* Forecast */}
        <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <TrendingUp size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Period-end forecast</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Based on current burn rate and attainment trajectory
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Forecasted payout</p>
                  <p className="text-lg font-bold tabular-nums">{inr(totals.totalPayout * 1.18)}</p>
                  <p className="text-[10px] text-muted-foreground">vs {inr(totals.totalBudget)} budget</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Forecasted sales</p>
                  <p className="text-lg font-bold tabular-nums text-[hsl(var(--success))]">
                    {inr(totals.totalSales * 1.22)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">+22% lift expected</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Closing ROI</p>
                  <p className="text-lg font-bold tabular-nums text-primary">
                    {((totals.totalSales * 1.22) / (totals.totalPayout * 1.18)).toFixed(1)}x
                  </p>
                  <p className="text-[10px] text-muted-foreground">+0.2x vs current</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Budget variance</p>
                  <p
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      totals.totalPayout * 1.18 > totals.totalBudget
                        ? "text-destructive"
                        : "text-[hsl(var(--success))]",
                    )}
                  >
                    {totals.totalPayout * 1.18 > totals.totalBudget ? "+" : "-"}
                    {inr(Math.abs(totals.totalBudget - totals.totalPayout * 1.18))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {totals.totalPayout * 1.18 > totals.totalBudget ? "Over budget" : "Under budget"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
