import type { KpiTemplateId } from "@/components/kpi-library/registry";
import type { GateRule, KpiGroup, KpiScope } from "@/components/wizard/builderState";

export interface SavedProgramKpi {
  templateId: KpiTemplateId;
  instanceId: string;
  config: unknown;
  customName?: string;
  groupIds?: string[];
  scope?: KpiScope;
}

export interface SavedProgram {
  id: string;
  name: string;
  channel?: "CCD" | "HCD";
  role: string;
  geographies: string[];
  geographyExceptions?: string[];
  monthYear: { month: number; year: number }; // 1-12, full year
  quarterLabel: string;
  attainmentBasis: string;
  currency: string;
  payoutFrequency: string;
  /** Channels defined on this programme (free-form tags). */
  channels?: string[];
  /** Optional KPI groupings. */
  kpiGroups?: KpiGroup[];
  kpis: SavedProgramKpi[];
  gates: GateRule[];
  createdAt: string;
}

const KEY = "savedPrograms.v1";

function read(): SavedProgram[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedProgram[]) : [];
  } catch {
    return [];
  }
}

function write(list: SavedProgram[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("savedPrograms:change"));
}

export function listPrograms(): SavedProgram[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProgram(id: string): SavedProgram | undefined {
  return read().find((p) => p.id === id);
}

export function saveProgram(p: SavedProgram) {
  const list = read().filter((x) => x.id !== p.id);
  list.unshift(p);
  write(list);
}

export function deleteProgram(id: string) {
  write(read().filter((p) => p.id !== id));
}

export function cloneProgram(id: string): SavedProgram | undefined {
  const src = read().find((p) => p.id === id);
  if (!src) return undefined;
  return {
    ...structuredClone(src),
    id: `prog_${Math.random().toString(36).slice(2, 10)}`,
    name: `${src.name} (copy)`,
    createdAt: new Date().toISOString(),
  };
}

// ─── Fiscal quarter helper (FY starts April) ──────────────────────────────
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function quarterForMonth(month: number, year: number) {
  const m = month - 1; // 0-indexed
  const fyYear = m >= 3 ? year + 1 : year;
  const fyShort = `FY${String(fyYear).slice(-2)}`;
  const fyMonthIdx = (m - 3 + 12) % 12;
  const q = Math.floor(fyMonthIdx / 3) + 1;
  const startMonth = (3 + (q - 1) * 3) % 12;
  const months = [startMonth, (startMonth + 1) % 12, (startMonth + 2) % 12].map((i) => MONTH_NAMES[i]);
  return { label: `Q${q} ${fyShort}`, period: months.join(" + "), full: `Q${q} ${fyShort} (${months.join(" + ")})` };
}

export function newProgramId() {
  return `prog_${Math.random().toString(36).slice(2, 10)}`;
}
