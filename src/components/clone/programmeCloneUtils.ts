import type {
  Programme,
  KpiConfig,
  RoleType,
  WorkingSegment,
  Channel,
} from "@/types/programme";

export const KPI_LABELS: Record<keyof Programme["kpis"], string> = {
  A_nsv: "NSV",
  B_phasing: "Phasing",
  C_eco: "ECO",
  D_tlsd: "TLS-D",
  E_dbb: "DBB",
  F_cft: "CFT",
  G_subDbBilling: "Sub-DB Billing",
  H_msb: "MSB",
  I_channelFocus: "Channel Focus",
  J_teamEarning: "Team Earning",
  K_appUsage: "App Usage",
  L_quarterly: "Quarterly Slab",
};

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatPeriod(p: Programme["period"]): string {
  return `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

export function formatRole(role: RoleType): string {
  return role === "ASO_ASE" ? "ASO/ASE" : role;
}

export function formatSegment(s: WorkingSegment): string {
  switch (s) {
    case "urban-retail": return "Urban Retail";
    case "urban-wholesale": return "Urban Wholesale";
    case "rural-ss": return "Rural (SS)";
    case "hybrid": return "Hybrid";
    case "urban": return "Urban";
    case "rural": return "Rural";
    case "urban-cities": return "Urban cities";
    case "other-markets": return "Other markets";
    case "all": return "All segments";
  }
}

export function formatType(p: Programme): string {
  return `${p.channel} · ${formatRole(p.role)} · ${formatSegment(p.segment)}`;
}

export function channelTone(c: Channel): string {
  return c === "CCD"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-purple-100 text-purple-800 border-purple-200";
}

export function hasMdmUpload(p: Programme): boolean {
  return Object.values(p.kpis).some(
    (k) => k?.enabled && k.dataFeed === "mdm-upload",
  );
}

export function nsvCap(p: Programme): number | null {
  const a = p.kpis.A_nsv;
  if (!a?.enabled) return null;
  if (a.linearSlab) return a.linearSlab.capAmount;
  if (a.tieredSlab?.tiers?.length) {
    return Math.max(...a.tieredSlab.tiers.map((t) => t.payout));
  }
  return null;
}

export function setNsvCap(p: Programme, cap: number): Programme {
  const a = p.kpis.A_nsv;
  if (!a?.enabled) return p;
  const next: KpiConfig = { ...a };
  if (next.linearSlab) {
    next.linearSlab = { ...next.linearSlab, capAmount: cap };
  } else if (next.tieredSlab?.tiers?.length) {
    const old = Math.max(...next.tieredSlab.tiers.map((t) => t.payout)) || 1;
    const ratio = cap / old;
    next.tieredSlab = {
      tiers: next.tieredSlab.tiers.map((t) => ({
        ...t,
        payout: Math.round(t.payout * ratio),
      })),
    };
  }
  return { ...p, kpis: { ...p.kpis, A_nsv: next } };
}

export function bumpPeriod(period: Programme["period"], months: number): Programme["period"] {
  const total = (period.year * 12 + (period.month - 1)) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return { month, year, isQ1: month <= 3 };
}

// ─── AI suggestion engine for Programme ─────────────────────────────────────

export interface KpiSuggestion {
  kpiKey: keyof Programme["kpis"];
  label: string;
  field: string;
  current: string;
  suggested: string;
  reason: string;
  apply: (p: Programme) => Programme;
}

export function generateProgrammeSuggestions(p: Programme): KpiSuggestion[] {
  const out: KpiSuggestion[] = [];

  // NSV stretch
  const nsv = p.kpis.A_nsv;
  if (nsv?.linearSlab) {
    const old = nsv.linearSlab.stepRate;
    const next = Math.round(old * 1.06);
    out.push({
      kpiKey: "A_nsv",
      label: KPI_LABELS.A_nsv,
      field: "Step rate",
      current: `₹${old}/1%`,
      suggested: `₹${next}/1%`,
      reason: `${formatSegment(p.segment)} attainment averaged 108% — increase to stretch target`,
      apply: (prog) => ({
        ...prog,
        kpis: {
          ...prog.kpis,
          A_nsv: { ...prog.kpis.A_nsv!, linearSlab: { ...prog.kpis.A_nsv!.linearSlab!, stepRate: next } },
        },
      }),
    });
  } else if (nsv?.tieredSlab?.tiers?.length) {
    const idx = nsv.tieredSlab.tiers.length - 1;
    const top = nsv.tieredSlab.tiers[idx];
    const next = Math.round(top.payout * 1.08 / 100) * 100;
    out.push({
      kpiKey: "A_nsv",
      label: KPI_LABELS.A_nsv,
      field: `Top tier (${top.label})`,
      current: `₹${top.payout.toLocaleString()}`,
      suggested: `₹${next.toLocaleString()}`,
      reason: "Top performers consistently exceed top tier — over-reward stretch",
      apply: (prog) => {
        const tiers = [...prog.kpis.A_nsv!.tieredSlab!.tiers];
        tiers[idx] = { ...tiers[idx], payout: next };
        return {
          ...prog,
          kpis: { ...prog.kpis, A_nsv: { ...prog.kpis.A_nsv!, tieredSlab: { tiers } } },
        };
      },
    });
  }

  // ECO floor
  const eco = p.kpis.C_eco;
  if (eco?.ecoConfig) {
    const old = eco.ecoConfig.minOutlets;
    const next = Math.round(old * 1.1);
    out.push({
      kpiKey: "C_eco",
      label: KPI_LABELS.C_eco,
      field: "Min outlets",
      current: `${old}`,
      suggested: `${next}`,
      reason: "78% of reps exceeded the previous floor — raise to maintain stretch",
      apply: (prog) => ({
        ...prog,
        kpis: {
          ...prog.kpis,
          C_eco: { ...prog.kpis.C_eco!, ecoConfig: { ...prog.kpis.C_eco!.ecoConfig!, minOutlets: next } },
        },
      }),
    });
  }

  // Phasing top tier
  const ph = p.kpis.B_phasing;
  if (ph?.phasingSlab) {
    const old = ph.phasingSlab.t75;
    const next = Math.round(old * 1.07 / 25) * 25;
    out.push({
      kpiKey: "B_phasing",
      label: KPI_LABELS.B_phasing,
      field: "t75 reward",
      current: `₹${old.toLocaleString()}`,
      suggested: `₹${next.toLocaleString()}`,
      reason: "Consistent over-achievement on top phasing tier",
      apply: (prog) => ({
        ...prog,
        kpis: {
          ...prog.kpis,
          B_phasing: { ...prog.kpis.B_phasing!, phasingSlab: { ...prog.kpis.B_phasing!.phasingSlab!, t75: next } },
        },
      }),
    });
  }

  return out;
}

export function diffProgramme(source: Programme, draft: Programme): string[] {
  const diffs: string[] = [];
  if (source.name !== draft.name) diffs.push(`Name: "${source.name}" → "${draft.name}"`);
  if (formatPeriod(source.period) !== formatPeriod(draft.period))
    diffs.push(`Period: ${formatPeriod(source.period)} → ${formatPeriod(draft.period)}`);
  if (source.status !== draft.status)
    diffs.push(`Status: ${source.status} → ${draft.status}`);
  const sCap = nsvCap(source);
  const dCap = nsvCap(draft);
  if (sCap !== null && dCap !== null && sCap !== dCap)
    diffs.push(`NSV cap: ₹${sCap.toLocaleString()} → ₹${dCap.toLocaleString()}`);
  // gates
  if (source.gates.nsvMinPct !== draft.gates.nsvMinPct)
    diffs.push(`NSV min %: ${source.gates.nsvMinPct} → ${draft.gates.nsvMinPct}`);
  if (source.gates.cftMinWorkingDays !== draft.gates.cftMinWorkingDays)
    diffs.push(`CFT min days: ${source.gates.cftMinWorkingDays} → ${draft.gates.cftMinWorkingDays}`);
  // Phasing diffs (any tier)
  const sp = source.kpis.B_phasing?.phasingSlab;
  const dp = draft.kpis.B_phasing?.phasingSlab;
  if (sp && dp) {
    (["t55", "t65", "t70", "t75"] as const).forEach((k) => {
      if (sp[k] !== dp[k]) diffs.push(`Phasing ${k}: ₹${sp[k]} → ₹${dp[k]}`);
    });
  }
  // ECO
  const se = source.kpis.C_eco?.ecoConfig;
  const de = draft.kpis.C_eco?.ecoConfig;
  if (se && de) {
    if (se.minOutlets !== de.minOutlets)
      diffs.push(`ECO min outlets: ${se.minOutlets} → ${de.minOutlets}`);
    if (se.ratePerOutlet !== de.ratePerOutlet)
      diffs.push(`ECO rate/outlet: ₹${se.ratePerOutlet} → ₹${de.ratePerOutlet}`);
    if (se.maxPayout !== de.maxPayout)
      diffs.push(`ECO max payout: ₹${se.maxPayout} → ₹${de.maxPayout}`);
  }
  return diffs;
}
