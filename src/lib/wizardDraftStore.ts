import type { BuilderState } from "@/components/wizard/builderState";

export interface WizardDraft {
  id: string;
  name: string;
  atStep: number;
  builder: BuilderState;
  updatedAt: string;
}

const KEY = "wizardDrafts.v1";

function read(): WizardDraft[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WizardDraft[]) : [];
  } catch {
    return [];
  }
}

function write(list: WizardDraft[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("wizardDrafts:change"));
}

export function listDrafts(): WizardDraft[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDraft(id: string): WizardDraft | undefined {
  return read().find((d) => d.id === id);
}

export function upsertDraft(d: WizardDraft) {
  const list = read().filter((x) => x.id !== d.id);
  list.unshift(d);
  write(list);
}

export function deleteDraft(id: string) {
  write(read().filter((d) => d.id !== id));
}

export function newDraftId() {
  return `draft_${Math.random().toString(36).slice(2, 10)}`;
}

const STEP_NAMES = ["Basics", "Audience", "KPIs", "Gates", "Review"];

/** Total steps in the create-programme wizard — drives draft progress display. */
export const TOTAL_WIZARD_STEPS = STEP_NAMES.length;

export function stepName(n: number): string {
  return STEP_NAMES[n - 1] || `Step ${n}`;
}
