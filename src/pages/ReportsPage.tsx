import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Users, TrendingUp } from "lucide-react";
import { listPrograms, type SavedProgram } from "@/lib/programStore";
import {
  describeKpi,
  describeGates,
  programMaxEarning,
  usersForProgram,
  computeAchievement,
  statusFor,
  monthYearLabel,
} from "@/lib/reportFields";
import { toast } from "sonner";

// ─── Demo programs (always included so downloads are rich) ─────────────────
const DEMO_PROGRAMS: SavedProgram[] = [
  {
    id: "demo_urban_retail_q2",
    name: "[Demo] Urban Retail MR — Q2 FY26 NSV Drive",
    role: "Urban Retail MR",
    geographies: ["Zone: West", "Zone: North", "State: Maharashtra"],
    monthYear: { month: 7, year: 2026 },
    quarterLabel: "Q2 FY26",
    attainmentBasis: "invoice",
    currency: "INR",
    payoutFrequency: "monthly",
    gates: [],
    createdAt: new Date().toISOString(),
    kpis: [
      { templateId: "nsv", instanceId: "n1",
        config: { basis: "secondary", stepMode: "stepup", cap: { enabled: true, pct: 110 }, gatesEnabled: false, gates: [],
          slabs: [{ pct: 95, ratePerPct: 240, entryPayout: 2400 }, { pct: 100, ratePerPct: 240 }, { pct: 105, ratePerPct: 240 }, { pct: 110, ratePerPct: 240 }] } },
      { templateId: "eco", instanceId: "e1",
        config: { role: "mr", minBillEnabled: true, minBillMode: "per_bill", minBillAmount: 250, rateMultiplier: 3, doubleBillingCountsTwice: false, cap: { enabled: true, outlets: 300 }, gatesEnabled: false, gates: [],
          slabs: [{ count: 150, ratePerOutlet: 10 }, { count: 200, ratePerOutlet: 15 }, { count: 250, ratePerOutlet: 20 }] } },
      { templateId: "tlsd", instanceId: "t1",
        config: { role: "mr", countingLevel: "group", minQtyEnabled: false, minQtyValue: 0, minQtyUom: "piece", minLines: 750, maxLines: 2500, ratePerLine: 1, rateMultiplier: 1, gatesEnabled: false, gates: [] } },
    ],
  },
  {
    id: "demo_kerala_mr",
    name: "[Demo] Kerala MR — Q2 FY26 Phasing + ECO",
    role: "Kerala MR",
    geographies: ["State: Kerala"],
    monthYear: { month: 7, year: 2026 },
    quarterLabel: "Q2 FY26",
    attainmentBasis: "invoice",
    currency: "INR",
    payoutFrequency: "monthly",
    gates: [],
    createdAt: new Date().toISOString(),
    kpis: [
      { templateId: "phasing", instanceId: "p1",
        config: { basis: "secondary", cutoffDay: 20, stepMode: "slab", cap: { enabled: false, pct: 0 }, gatesEnabled: false, gates: [],
          slabs: [{ pct: 55, ratePerPct: 0, entryPayout: 450 }, { pct: 65, ratePerPct: 0, entryPayout: 850 }, { pct: 75, ratePerPct: 0, entryPayout: 1330 }] } },
      { templateId: "eco", instanceId: "e2",
        config: { role: "mr", minBillEnabled: true, minBillMode: "per_bill", minBillAmount: 200, rateMultiplier: 3, doubleBillingCountsTwice: false, cap: { enabled: false, outlets: 0 }, gatesEnabled: false, gates: [],
          slabs: [{ count: 120, ratePerOutlet: 12 }, { count: 180, ratePerOutlet: 18 }, { count: 240, ratePerOutlet: 24 }] } },
    ],
  },
  {
    id: "demo_aso_india",
    name: "[Demo] ASO/ASE All India — Quarterly NSV Bonus",
    role: "ASO/ASE (All India)",
    geographies: ["All regions"],
    monthYear: { month: 7, year: 2026 },
    quarterLabel: "Q2 FY26",
    attainmentBasis: "invoice",
    currency: "INR",
    payoutFrequency: "quarterly",
    gates: [],
    createdAt: new Date().toISOString(),
    kpis: [
      { templateId: "qnsv", instanceId: "q1",
        config: { basis: "secondary", stepMode: "stepup", cap: { enabled: true, pct: 110 }, gatesEnabled: false, gates: [],
          slabs: [{ pct: 95, ratePerPct: 400, entryPayout: 4000 }, { pct: 100, ratePerPct: 400 }, { pct: 105, ratePerPct: 400 }] } },
      { templateId: "dbb", instanceId: "d1",
        config: { role: "aso_ase", countingLevel: "group", minQtyEnabled: false, minQtyValue: 0, minQtyUom: "piece", minLines: 200, maxLines: 800, ratePerLine: 3, rateMultiplier: 1.2, gatesEnabled: false, gates: [] } },
    ],
  },
];

// ─── Builders ─────────────────────────────────────────────────────────────

function buildUserDump(programs: SavedProgram[]) {
  const rows: Record<string, unknown>[] = [];
  programs.forEach((p) => {
    const users = usersForProgram(p);
    const progMax = programMaxEarning(p);
    const gateText = describeGates(p);
    const period = monthYearLabel(p);
    const baseProgram = {
      "Program ID": p.id,
      "Program Name": p.name,
      "Channel": p.channel ?? "—",
      "Role": p.role,
      "Quarter": p.quarterLabel,
      "Period": period,
      "Payout Frequency": p.payoutFrequency,
      "Currency": p.currency,
      "Attainment Basis": p.attainmentBasis,
      "Geographies": p.geographies.join(", "),
      "Geography Exceptions": (p.geographyExceptions ?? []).join(", "),
      "Program Gates": gateText,
    };
    users.forEach((u) => {
      const baseUser = {
        ...baseProgram,
        "Employee ID": u.empId,
        "Employee Name": u.name,
        "Email": u.email,
        "Region": u.region,
        "State": u.state,
        "City": u.city,
        "Reporting Manager": u.reportingManager,
        "Join Date": u.joinDate,
        "Active": u.active ? "Yes" : "No",
      };
      if (!p.kpis.length) {
        rows.push({ ...baseUser, "KPI Name": "—", "KPI Category": "—", "KPI Scope": "—", "KPI Group": "—", "Measurement Basis": "—", "Target": "—", "Slab Structure": "—", "Max Payout per User (₹)": 0, "Program Max Earning (₹)": progMax });
        return;
      }
      p.kpis.forEach((k) => {
        const info = describeKpi(k);
        const groupNames = (k.groupIds ?? [])
          .map((gid) => p.kpiGroups?.find((g) => g.id === gid)?.name)
          .filter(Boolean)
          .join(", ");
        rows.push({
          ...baseUser,
          "KPI Name": info.name,
          "KPI Category": info.category,
          "KPI Scope": k.scope ?? "individual",
          "KPI Group": groupNames || "—",
          "Measurement Basis": info.basis,
          "Target": info.target,
          "Slab Structure": info.slabs,
          "Max Payout per User (₹)": info.maxPayout,
          "Program Max Earning (₹)": progMax,
        });
      });
    });
  });
  return rows;
}

function buildAchievementReport(programs: SavedProgram[]) {
  const rows: Record<string, unknown>[] = [];
  const today = new Date().toISOString().slice(0, 10);
  programs.forEach((p) => {
    const users = usersForProgram(p);
    users.forEach((u) => {
      if (!p.kpis.length) return;
      p.kpis.forEach((k) => {
        const info = describeKpi(k);
        const ach = computeAchievement(p, u, k);
        rows.push({
          "Program ID": p.id,
          "Program Name": p.name,
          "Role": p.role,
          "Quarter": p.quarterLabel,
          "Period": monthYearLabel(p),
          "Employee ID": u.empId,
          "Employee Name": u.name,
          "Region": u.region,
          "State": u.state,
          "City": u.city,
          "Reporting Manager": u.reportingManager,
          "KPI Name": info.name,
          "KPI Category": info.category,
          "Target": info.target,
          "Actual": ach.actual,
          "Achievement %": ach.achievementPct,
          "Slab Achieved": ach.slabAchieved,
          "Max Payout (₹)": info.maxPayout,
          "Earned Payout (₹)": ach.earnedPayout,
          "Payout Utilization %": ach.utilizationPct,
          "Gate Status": p.gates?.length ? "Pass" : "—",
          "Status": statusFor(ach.achievementPct),
          "Last Updated": today,
        });
      });
    });
  });
  return rows;
}

function buildProgramSummary(programs: SavedProgram[]) {
  return programs.map((p) => {
    const users = usersForProgram(p);
    let totalAch = 0;
    let n = 0;
    let earned = 0;
    let maxSum = 0;
    users.forEach((u) => {
      p.kpis.forEach((k) => {
        const info = describeKpi(k);
        const ach = computeAchievement(p, u, k);
        totalAch += ach.achievementPct;
        earned += ach.earnedPayout;
        maxSum += info.maxPayout;
        n += 1;
      });
    });
    return {
      "Program ID": p.id,
      "Program Name": p.name,
      "Role": p.role,
      "Quarter": p.quarterLabel,
      "Enrolled Users": users.length,
      "KPI Instances": p.kpis.length,
      "Avg Achievement %": n ? Math.round((totalAch / n) * 10) / 10 : 0,
      "Sum Earned Payout (₹)": Math.round(earned),
      "Sum Max Payout (₹)": Math.round(maxSum),
      "Payout Utilization %": maxSum > 0 ? Math.round((earned / maxSum) * 1000) / 10 : 0,
    };
  });
}

function autoWidthCols(rows: object[]) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((k) => ({
    wch: Math.min(40, Math.max(k.length + 2, ...rows.slice(0, 100).map((r) => String((r as Record<string, unknown>)[k] ?? "").length + 2))),
  }));
}

function downloadDump(programs: SavedProgram[]) {
  const rows = buildUserDump(programs);
  if (!rows.length) { toast.error("No data to export"); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  Object.assign(ws, { "!cols": autoWidthCols(rows), "!freeze": { xSplit: 0, ySplit: 1 } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users × Targets");
  const file = `user-level-dump_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, file);
  toast.success(`Downloaded ${file}`, { description: `${rows.length} rows` });
}

function downloadAchievement(programs: SavedProgram[]) {
  const rows = buildAchievementReport(programs);
  if (!rows.length) { toast.error("No data to export"); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  Object.assign(ws, { "!cols": autoWidthCols(rows), "!freeze": { xSplit: 0, ySplit: 1 } });
  const summary = buildProgramSummary(programs);
  const ws2 = XLSX.utils.json_to_sheet(summary);
  Object.assign(ws2, { "!cols": autoWidthCols(summary) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Achievement");
  XLSX.utils.book_append_sheet(wb, ws2, "Program Summary");
  const file = `user-achievement_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, file);
  toast.success(`Downloaded ${file}`, { description: `${rows.length} rows + summary` });
}

// ─── Page ──────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const [savedPrograms, setSavedPrograms] = useState<SavedProgram[]>(() => listPrograms());

  useEffect(() => {
    const h = () => setSavedPrograms(listPrograms());
    window.addEventListener("savedPrograms:change", h);
    return () => window.removeEventListener("savedPrograms:change", h);
  }, []);

  const programs = [...savedPrograms, ...DEMO_PROGRAMS];

  const reports = [
    {
      id: "user-dump",
      title: "User Level Dump",
      desc: "Static config snapshot: every enrolled user × every KPI with measurement basis, target, slab structure and max earning potential — exactly as set up during program creation.",
      icon: <Users size={20} />,
      action: () => downloadDump(programs),
      cta: "Download dump",
    },
    {
      id: "user-achievement",
      title: "User Level Achievement Report",
      desc: "Runtime snapshot: per-user actuals, achievement %, slab cleared, earned payout, utilization and status (Achieved / On Track / At Risk) across every KPI. Includes a Program Summary sheet.",
      icon: <TrendingUp size={20} />,
      action: () => downloadAchievement(programs),
      cta: "Download report",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="bg-card rounded-xl mx-4 mt-4 mb-4 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-[26px] bg-primary rounded-full" />
          <div>
            <h1 className="text-[22px] font-semibold text-foreground leading-tight">Reports & Dumps</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Download incentive program data — user-level targets and achievement reports.
            </p>
          </div>
        </div>

        {programs.length === 0 && (
          <Card className="p-4 border-dashed bg-muted/30">
            <p className="text-sm text-muted-foreground">
              No programs created yet. Reports will still download with demo data; creating a program injects its real users and targets.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((r) => (
            <Card key={r.id} className="p-5 flex flex-col gap-4 hover:border-primary/40 transition">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {r.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.desc}</p>
                </div>
              </div>
              <div className="flex-1" />
              <Button onClick={r.action} className="gap-2 self-start" size="sm">
                <Download size={14} /> {r.cta}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
