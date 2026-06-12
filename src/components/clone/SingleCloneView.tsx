import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Pencil,
  AlertTriangle,
  RotateCcw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { KpiConfig, Programme } from "@/types/programme";
import {
  KPI_LABELS,
  formatPeriod,
  formatType,
  formatRole,
  formatSegment,
  channelTone,
  diffProgramme,
  MONTH_NAMES,
} from "./programmeCloneUtils";

interface SingleCloneViewProps {
  program: Programme;
  onBack: () => void;
  onConfirm: () => void;
}

type EditSection = "basics" | "audience" | "kpis" | "gates";
type Mode = { kind: "review" } | { kind: "edit"; section: EditSection };

const SECTION_TITLES: Record<EditSection, string> = {
  basics: "Programme basics",
  audience: "Audience",
  kpis: "KPIs & payouts",
  gates: "Gate conditions",
};

export function SingleCloneView({ program, onBack, onConfirm }: SingleCloneViewProps) {
  const [draft, setDraft] = useState<Programme>(() => ({
    ...program,
    name: `${program.name} — Copy`,
    status: "draft",
    kpis: structuredClone(program.kpis),
    gates: { ...program.gates },
    period: { ...program.period },
  }));
  const [mode, setMode] = useState<Mode>({ kind: "review" });

  const diffs = useMemo(() => diffProgramme(program, draft), [program, draft]);
  const sectionDiffs = useMemo(() => sectionDiffMap(diffs), [diffs]);

  const resetSection = (s: EditSection) => {
    setDraft((d) => {
      const next: Programme = {
        ...d,
        kpis: structuredClone(d.kpis),
        gates: { ...d.gates },
        period: { ...d.period },
      };
      if (s === "basics") {
        next.name = `${program.name} — Copy`;
        next.period = { ...program.period };
        next.status = "draft";
        next.maxMonthlyEarning = program.maxMonthlyEarning;
      }
      if (s === "audience") {
        next.channel = program.channel;
        next.role = program.role;
        next.segment = program.segment;
        next.geography = program.geography;
      }
      if (s === "kpis") next.kpis = structuredClone(program.kpis);
      if (s === "gates") next.gates = { ...program.gates };
      return next;
    });
    toast.success(`${SECTION_TITLES[s]} reset to source`);
  };

  // ── EDIT MODE: one focused section, "Back to review" returns here ────
  if (mode.kind === "edit") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
        <div className="border-b border-border bg-card px-6 py-3 shrink-0 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode({ kind: "review" })}
            className="gap-1 text-xs"
          >
            <ArrowLeft size={14} /> Back to review
          </Button>
          <div className="text-xs font-medium text-muted-foreground">
            Editing · {SECTION_TITLES[mode.section]}
          </div>
          <Button
            size="sm"
            className="text-xs gap-1"
            onClick={() => {
              setMode({ kind: "review" });
              toast.success(`${SECTION_TITLES[mode.section]} updated`);
            }}
          >
            <Check size={14} /> Done — back to review
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6">
            <SectionEditor
              section={mode.section}
              draft={draft}
              source={program}
              onChange={setDraft}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── REVIEW MODE ─────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
      <div className="border-b border-border bg-card px-6 py-3 shrink-0 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
          <ArrowLeft size={14} /> Back to programmes
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.success("Saved as draft");
              onConfirm();
            }}
          >
            Save as Draft
          </Button>
          <Button
            size="sm"
            onClick={() => {
              toast.success(`${draft.name} published`);
              onConfirm();
            }}
          >
            Publish
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-5">
          {/* Header */}
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cloning · Review
            </p>
            <h1 className="text-xl font-bold mt-1 text-foreground">{draft.name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px]", channelTone(draft.channel))}>
                {formatType(draft)}
              </Badge>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{formatPeriod(draft.period)}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                Max ₹{draft.maxMonthlyEarning.toLocaleString()}/mo
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                Source: <span className="text-foreground">{program.name}</span>
              </span>
            </div>
          </div>

          {/* What changed — sticky top */}
          <div
            className={cn(
              "border rounded-xl p-4",
              diffs.length > 0
                ? "bg-amber-50 border-amber-300 dark:bg-amber-950/20"
                : "bg-card border-border",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                {diffs.length > 0 && (
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                )}
                What changed {diffs.length > 0 && <span className="text-amber-700">({diffs.length})</span>}
              </h3>
            </div>
            {diffs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No changes yet — this is an exact copy of the source.
              </p>
            ) : (
              <ul className="space-y-1">
                {diffs.map((d, i) => (
                  <li key={i} className="text-xs text-foreground">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 align-middle" />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sections */}
          <ReviewSection
            id="basics"
            changed={sectionDiffs.basics}
            onEdit={() => setMode({ kind: "edit", section: "basics" })}
            onReset={() => resetSection("basics")}
          >
            <SummaryGrid
              rows={[
                ["Name", draft.name, draft.name !== program.name],
                ["Month", formatPeriod(draft.period), formatPeriod(draft.period) !== formatPeriod(program.period)],
                ["Status", draft.status, draft.status !== program.status],
                [
                  "Max monthly",
                  `₹${draft.maxMonthlyEarning.toLocaleString()}`,
                  draft.maxMonthlyEarning !== program.maxMonthlyEarning,
                ],
              ]}
            />
          </ReviewSection>

          <ReviewSection
            id="audience"
            changed={sectionDiffs.audience}
            onEdit={() => setMode({ kind: "edit", section: "audience" })}
            onReset={() => resetSection("audience")}
          >
            <SummaryGrid
              rows={[
                ["Channel", draft.channel, draft.channel !== program.channel],
                ["Role", formatRole(draft.role), draft.role !== program.role],
                ["Segment", formatSegment(draft.segment), draft.segment !== program.segment],
                ["Geography", draft.geography, draft.geography !== program.geography],
              ]}
            />
          </ReviewSection>

          <ReviewSection
            id="kpis"
            changed={sectionDiffs.kpis}
            onEdit={() => setMode({ kind: "edit", section: "kpis" })}
            onReset={() => resetSection("kpis")}
          >
            <ul className="space-y-1.5 text-xs">
              {(Object.entries(draft.kpis) as [keyof Programme["kpis"], KpiConfig | undefined][])
                .filter(([, v]) => v?.enabled)
                .map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-foreground">{KPI_LABELS[k]}</span>
                    <span className="text-muted-foreground tabular-nums">{kpiSummary(v)}</span>
                  </li>
                ))}
            </ul>
          </ReviewSection>

          <ReviewSection
            id="gates"
            changed={sectionDiffs.gates}
            onEdit={() => setMode({ kind: "edit", section: "gates" })}
            onReset={() => resetSection("gates")}
          >
            <SummaryGrid
              rows={[
                ["NSV min %", `${draft.gates.nsvMinPct}%`, draft.gates.nsvMinPct !== program.gates.nsvMinPct],
                [
                  "CFT urban hrs",
                  String(draft.gates.cftUrbanHrs),
                  draft.gates.cftUrbanHrs !== program.gates.cftUrbanHrs,
                ],
                [
                  "CFT rural hrs",
                  String(draft.gates.cftRuralHrs),
                  draft.gates.cftRuralHrs !== program.gates.cftRuralHrs,
                ],
                [
                  "Min working days",
                  String(draft.gates.cftMinWorkingDays),
                  draft.gates.cftMinWorkingDays !== program.gates.cftMinWorkingDays,
                ],
              ]}
            />
          </ReviewSection>
        </div>
      </div>
    </div>
  );
}

// ── Review section card ─────────────────────────────────────────────────
function ReviewSection({
  id,
  changed,
  onEdit,
  onReset,
  children,
}: {
  id: EditSection;
  changed: boolean;
  onEdit: () => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card border rounded-xl overflow-hidden",
        changed ? "border-amber-300 ring-1 ring-amber-200" : "border-border",
      )}
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{SECTION_TITLES[id]}</h3>
          {changed && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              modified
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {changed && (
            <button
              type="button"
              onClick={onReset}
              className="text-[10px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
            >
              <RotateCcw size={10} /> Reset
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onEdit}
          >
            <Pencil size={12} /> Edit
          </Button>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SummaryGrid({ rows }: { rows: [string, string, boolean][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      {rows.map(([k, v, changed]) => (
        <div key={k} className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd
            className={cn(
              "font-medium text-right truncate",
              changed ? "text-amber-700" : "text-foreground",
            )}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── Section editors ─────────────────────────────────────────────────────
function SectionEditor({
  section,
  draft,
  source,
  onChange,
}: {
  section: EditSection;
  draft: Programme;
  source: Programme;
  onChange: (p: Programme) => void;
}) {
  if (section === "basics") {
    return (
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <Label className="text-xs">Programme name</Label>
          <Input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Month</Label>
            <Select
              value={String(draft.period.month)}
              onValueChange={(v) =>
                onChange({ ...draft, period: { ...draft.period, month: Number(v) } })
              }
            >
              <SelectTrigger className="h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Year</Label>
            <Input
              type="number"
              value={draft.period.year}
              onChange={(e) =>
                onChange({ ...draft, period: { ...draft.period, year: Number(e.target.value) } })
              }
              className="h-9 mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => onChange({ ...draft, status: v as Programme["status"] })}
            >
              <SelectTrigger className="h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Max monthly earning ₹</Label>
          <Input
            type="number"
            value={draft.maxMonthlyEarning}
            onChange={(e) => onChange({ ...draft, maxMonthlyEarning: Number(e.target.value) })}
            className="h-9 mt-1 text-sm"
          />
        </div>
      </div>
    );
  }

  if (section === "audience") {
    return (
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Channel</Label>
            <Select
              value={draft.channel}
              onValueChange={(v) => onChange({ ...draft, channel: v as Programme["channel"] })}
            >
              <SelectTrigger className="h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CCD">CCD</SelectItem>
                <SelectItem value="HCD">HCD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select
              value={draft.role}
              onValueChange={(v) => onChange({ ...draft, role: v as Programme["role"] })}
            >
              <SelectTrigger className="h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MR">MR</SelectItem>
                <SelectItem value="ASO_ASE">ASO/ASE</SelectItem>
                <SelectItem value="ASO">ASO</SelectItem>
                <SelectItem value="ASM">ASM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Segment</Label>
            <Select
              value={draft.segment}
              onValueChange={(v) => onChange({ ...draft, segment: v as Programme["segment"] })}
            >
              <SelectTrigger className="h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["urban-retail","urban-wholesale","rural-ss","hybrid","urban","rural","urban-cities","other-markets","all"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{formatSegment(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Geography</Label>
            <Select
              value={draft.geography}
              onValueChange={(v) => onChange({ ...draft, geography: v as Programme["geography"] })}
            >
              <SelectTrigger className="h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-india">All India</SelectItem>
                <SelectItem value="kerala">Kerala</SelectItem>
                <SelectItem value="urban-cities">Urban cities</SelectItem>
                <SelectItem value="other-markets">Other markets</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  if (section === "kpis") {
    return (
      <div className="space-y-4">
        {Object.values(draft.kpis).some((k) => k?.enabled && k.dataFeed === "mdm-upload") && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-800">
              Re-upload required for new period — MDM feed.
            </p>
          </div>
        )}
        {draft.kpis.A_nsv?.enabled && (
          <KpiBlock title="NSV slab">
            <NsvEditor
              cfg={draft.kpis.A_nsv}
              source={source.kpis.A_nsv}
              onChange={(cfg) => onChange({ ...draft, kpis: { ...draft.kpis, A_nsv: cfg } })}
            />
          </KpiBlock>
        )}
        {draft.kpis.B_phasing?.phasingSlab && (
          <KpiBlock title="Phasing">
            <PhasingEditor
              cfg={draft.kpis.B_phasing}
              source={source.kpis.B_phasing}
              onChange={(cfg) => onChange({ ...draft, kpis: { ...draft.kpis, B_phasing: cfg } })}
            />
          </KpiBlock>
        )}
        {draft.kpis.C_eco?.ecoConfig && (
          <KpiBlock title="ECO">
            <EcoEditor
              label={KPI_LABELS.C_eco}
              cfg={draft.kpis.C_eco}
              onChange={(cfg) => onChange({ ...draft, kpis: { ...draft.kpis, C_eco: cfg } })}
            />
          </KpiBlock>
        )}
      </div>
    );
  }

  // gates
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="NSV min %"
          value={draft.gates.nsvMinPct}
          onChange={(v) => onChange({ ...draft, gates: { ...draft.gates, nsvMinPct: v } })}
        />
        {draft.gates.gtCollectionMinPct !== undefined && (
          <NumField
            label="GT collection gate %"
            value={draft.gates.gtCollectionMinPct}
            onChange={(v) =>
              onChange({ ...draft, gates: { ...draft.gates, gtCollectionMinPct: v } })
            }
          />
        )}
        <NumField
          label="CFT urban hrs"
          value={draft.gates.cftUrbanHrs}
          onChange={(v) => onChange({ ...draft, gates: { ...draft.gates, cftUrbanHrs: v } })}
        />
        <NumField
          label="CFT rural hrs"
          value={draft.gates.cftRuralHrs}
          onChange={(v) => onChange({ ...draft, gates: { ...draft.gates, cftRuralHrs: v } })}
        />
        <NumField
          label="Min working days"
          value={draft.gates.cftMinWorkingDays}
          onChange={(v) => onChange({ ...draft, gates: { ...draft.gates, cftMinWorkingDays: v } })}
        />
      </div>
    </div>
  );
}

function KpiBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h4 className="text-sm font-semibold text-foreground mb-3">{title}</h4>
      {children}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────
function sectionDiffMap(diffs: string[]): Record<EditSection, boolean> {
  const out: Record<EditSection, boolean> = {
    basics: false,
    audience: false,
    kpis: false,
    gates: false,
  };
  for (const d of diffs) {
    if (/^Name:|^Period:|^Status:|^Max monthly/i.test(d)) out.basics = true;
    else if (/^Channel:|^Role:|^Segment:|^Geography:/i.test(d)) out.audience = true;
    else if (/^NSV min %|^CFT|^Min working/i.test(d)) out.gates = true;
    else out.kpis = true;
  }
  return out;
}

// ── Editors (reused from previous implementation) ───────────────────────

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 mt-1 text-sm"
      />
    </div>
  );
}

function NsvEditor({ cfg, source, onChange }: { cfg: NonNullable<Programme["kpis"]["A_nsv"]>; source?: Programme["kpis"]["A_nsv"]; onChange: (cfg: NonNullable<Programme["kpis"]["A_nsv"]>) => void }) {
  if (cfg.linearSlab) {
    const ls = cfg.linearSlab;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Entry ₹" value={ls.entryAmount}
            onChange={(v) => onChange({ ...cfg, linearSlab: { ...ls, entryAmount: v } })} />
          <NumField label="Step rate ₹/1%" value={ls.stepRate}
            onChange={(v) => onChange({ ...cfg, linearSlab: { ...ls, stepRate: v } })} />
          <NumField label="Cap ₹" value={ls.capAmount}
            onChange={(v) => onChange({ ...cfg, linearSlab: { ...ls, capAmount: v } })} />
        </div>
      </div>
    );
  }
  if (cfg.tieredSlab?.tiers) {
    return (
      <div className="space-y-2">
        {cfg.tieredSlab.tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_120px] gap-2 items-end">
            <div>
              <Label className="text-xs">Tier label</Label>
              <Input value={t.label} className="h-8 mt-1 text-sm"
                onChange={(e) => {
                  const tiers = [...cfg.tieredSlab!.tiers];
                  tiers[i] = { ...t, label: e.target.value };
                  onChange({ ...cfg, tieredSlab: { tiers } });
                }} />
            </div>
            <NumField label="Threshold %" value={t.thresholdPct}
              onChange={(v) => {
                const tiers = [...cfg.tieredSlab!.tiers];
                tiers[i] = { ...t, thresholdPct: v };
                onChange({ ...cfg, tieredSlab: { tiers } });
              }} />
            <NumField label="Payout ₹" value={t.payout}
              onChange={(v) => {
                const tiers = [...cfg.tieredSlab!.tiers];
                tiers[i] = { ...t, payout: v };
                onChange({ ...cfg, tieredSlab: { tiers } });
              }} />
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-xs text-muted-foreground">No NSV slab configured.</p>;
}

function PhasingEditor({ cfg, onChange }: { cfg: NonNullable<Programme["kpis"]["B_phasing"]>; onChange: (cfg: NonNullable<Programme["kpis"]["B_phasing"]>) => void; source?: Programme["kpis"]["B_phasing"] }) {
  const ps = cfg.phasingSlab!;
  return (
    <div className="grid grid-cols-4 gap-2">
      {(["t55", "t65", "t70", "t75"] as const).map((k) => (
        <NumField key={k} label={`${k.toUpperCase()} ₹`} value={ps[k]}
          onChange={(v) => onChange({ ...cfg, phasingSlab: { ...ps, [k]: v } })} />
      ))}
    </div>
  );
}

function EcoEditor({ label, cfg, onChange }: { label: string; cfg: NonNullable<Programme["kpis"]["C_eco"]>; onChange: (cfg: NonNullable<Programme["kpis"]["C_eco"]>) => void }) {
  const e = cfg.ecoConfig!;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <NumField label="Min outlets" value={e.minOutlets}
          onChange={(v) => onChange({ ...cfg, ecoConfig: { ...e, minOutlets: v } })} />
        <NumField label="Rate / outlet ₹" value={e.ratePerOutlet}
          onChange={(v) => onChange({ ...cfg, ecoConfig: { ...e, ratePerOutlet: v } })} />
        <NumField label="Max payout ₹" value={e.maxPayout}
          onChange={(v) => onChange({ ...cfg, ecoConfig: { ...e, maxPayout: v } })} />
      </div>
    </div>
  );
}

function kpiSummary(v: KpiConfig | undefined): string {
  if (v?.linearSlab) return `entry ₹${v.linearSlab.entryAmount}, cap ₹${v.linearSlab.capAmount}`;
  if (v?.tieredSlab?.tiers?.length) return `${v.tieredSlab.tiers.length} tiers, top ₹${Math.max(...v.tieredSlab.tiers.map((t) => t.payout)).toLocaleString()}`;
  if (v?.phasingSlab) return `t75 ₹${v.phasingSlab.t75.toLocaleString()}`;
  if (v?.ecoConfig) return `${v.ecoConfig.minOutlets} outlets, max ₹${v.ecoConfig.maxPayout}`;
  if (v?.perLineSlab) return `${v.perLineSlab.minLines}-${v.perLineSlab.maxLines} lines`;
  if (v?.flatTrigger) return `≥${v.flatTrigger.thresholdPct}% → ₹${v.flatTrigger.payout}`;
  if (v?.payoutAmount) return `₹${v.payoutAmount.toLocaleString()}`;
  return "configured";
}
