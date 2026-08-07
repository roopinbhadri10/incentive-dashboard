import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RepDrilldownData {
  name: string;
  program: string;
  region: string;
  attainment: number;
  earnings: number;
  outlets: number;
}

const inr = (n: number) =>
  n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)}Cr` :
  n >= 100_000 ? `₹${(n / 100_000).toFixed(1)}L` :
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n}`;

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function TrendLine({ values }: { values: number[] }) {
  const w = 560, h = 120, pad = 8;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const path = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <line x1={pad} x2={w - pad} y1={h - pad - ((100 - min) / (max - min || 1)) * (h - pad * 2)}
            y2={h - pad - ((100 - min) / (max - min || 1)) * (h - pad * 2)}
            stroke="hsl(var(--border))" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5} />
      {values.map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={3} fill="hsl(var(--primary))" />
            <text x={x} y={h} textAnchor="middle" className="text-[9px] fill-muted-foreground">W{i + 1}</text>
            <text x={x} y={y - 6} textAnchor="middle" className="text-[9px] fill-foreground font-semibold">{v}%</text>
          </g>
        );
      })}
    </svg>
  );
}

export function RepDrilldownSheet({
  open, onOpenChange, rep,
}: { open: boolean; onOpenChange: (o: boolean) => void; rep: RepDrilldownData | null }) {
  if (!rep) return null;
  const seed = hashCode(rep.name);
  const rand = (n: number, mod: number) => ((seed >> n) % mod + mod) % mod;

  const roles = ["MR", "ASM", "TSI", "RSM"];
  const divisions = ["General Trade", "Modern Trade", "Wholesale", "Horeca"];
  const role = roles[rand(0, 4)];
  const division = divisions[rand(2, 4)];
  const empId = `EMP-${10000 + rand(4, 90000)}`;

  const maxPayout = 25000 + rand(6, 30000);
  const estPayout = rep.earnings;
  const attain = rep.attainment;

  const kpis = [
    { name: "Net Sales Value", target: 1800000, actual: Math.round(1800000 * attain / 100), weight: 40 },
    { name: "Outlet Coverage", target: 120, actual: Math.round(120 * (attain - 5) / 100), weight: 25 },
    { name: "Focus SKU Distribution", target: 80, actual: Math.round(80 * (attain + 4) / 100), weight: 20 },
    { name: "Productivity (Bills/day)", target: 22, actual: Math.round(22 * (attain - 8) / 100), weight: 15 },
  ].map((k) => {
    const pct = Math.round((k.actual / k.target) * 100);
    const slab = pct >= 115 ? "Accelerator (125%)" : pct >= 100 ? "Full (100%)" : pct >= 80 ? "Partial (75%)" : pct >= 60 ? "Threshold (40%)" : "—";
    const payout = Math.round(maxPayout * (k.weight / 100) * (pct >= 115 ? 1.25 : pct >= 100 ? 1 : pct >= 80 ? 0.75 : pct >= 60 ? 0.4 : 0));
    return { ...k, pct, slab, payout };
  });

  const gates = [
    { name: "Beat Plan Adherence ≥ 85%", pass: attain >= 65 },
    { name: "No Pending Returns > ₹5K", pass: attain >= 50 },
    { name: "Min 60 Outlets Billed", pass: attain >= 55 },
  ];

  const trend = Array.from({ length: 8 }, (_, i) => {
    const base = Math.max(20, attain - 25 + i * 4);
    return Math.min(160, base + (rand(i + 1, 10) - 5));
  });
  trend[7] = attain;

  const months = ["Dec '25", "Jan '26", "Feb '26", "Mar '26", "Apr '26", "May '26"];
  const programs = ["Q4 Push", "New Year Sprint", "Republic Day", "Spring Drive", "Summer Hot", "Pre-Monsoon"];
  const history = months.map((m, i) => {
    const att = 60 + ((seed >> (i * 2)) % 60);
    return {
      period: m,
      program: programs[i],
      payout: Math.round(maxPayout * 0.6 * (att / 100)),
      attainment: att,
    };
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{rep.name} — Incentive Profile</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {/* Rep header */}
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div><p className="text-[10px] uppercase text-muted-foreground">Name</p><p className="font-semibold">{rep.name}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Role</p><p className="font-semibold">{role}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Division</p><p className="font-semibold">{division}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Region</p><p className="font-semibold">{rep.region}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Employee ID</p><p className="font-semibold tabular-nums">{empId}</p></div>
            </div>
          </Card>

          {/* Active programme */}
          <Card className="p-4 border-l-4 border-l-primary">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Active Programme</p>
                <h3 className="text-base font-semibold">{rep.program}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Period: 1 May – 31 May 2026</p>
              </div>
              <Badge variant="outline" className="text-[10px]"><Target size={10} className="mr-1" /> {attain}% attainment</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t">
              <div><p className="text-[10px] uppercase text-muted-foreground">Max payout</p><p className="text-lg font-bold tabular-nums">{inr(maxPayout)}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Est. payout</p><p className="text-lg font-bold tabular-nums text-primary">{inr(estPayout)}</p></div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Attainment</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={Math.min(attain, 100)} className="h-2 flex-1" />
                  <span className="text-sm font-bold tabular-nums">{attain}%</span>
                </div>
              </div>
            </div>
          </Card>

          {/* KPI breakdown */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">KPI-wise breakdown</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">KPI</TableHead>
                  <TableHead className="text-xs text-right">Target</TableHead>
                  <TableHead className="text-xs text-right">Actual</TableHead>
                  <TableHead className="text-xs text-right">% Achieved</TableHead>
                  <TableHead className="text-xs">Slab cleared</TableHead>
                  <TableHead className="text-xs text-right">Payout earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.map((k) => (
                  <TableRow key={k.name}>
                    <TableCell className="text-sm font-medium">{k.name}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{k.target.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{k.actual.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-xs font-bold tabular-nums",
                        k.pct >= 100 ? "text-[hsl(var(--success))]" : k.pct >= 70 ? "text-[hsl(var(--warning))]" : "text-destructive")}>
                        {k.pct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{k.slab}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{inr(k.payout)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Gates */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Gates status</h3>
            <div className="space-y-2">
              {gates.map((g) => (
                <div key={g.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-sm">{g.name}</span>
                  {g.pass ? (
                    <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20 border-0">
                      <CheckCircle2 size={12} className="mr-1" /> Pass
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-0">
                      <XCircle size={12} className="mr-1" /> Fail
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Trend chart */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">8-week attainment trend</h3>
            <p className="text-xs text-muted-foreground mb-3">Weekly % attainment vs target</p>
            <TrendLine values={trend} />
          </Card>

          {/* Historical earnings */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy size={14} /> Historical earnings — last 6 months</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Period</TableHead>
                  <TableHead className="text-xs">Programme</TableHead>
                  <TableHead className="text-xs text-right">Payout earned</TableHead>
                  <TableHead className="text-xs text-right">Attainment %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.period}>
                    <TableCell className="text-sm font-medium">{h.period}</TableCell>
                    <TableCell className="text-sm">{h.program}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{inr(h.payout)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{h.attainment}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
