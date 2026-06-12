import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Programme } from "@/types/programme";
import {
  formatPeriod,
  formatType,
  channelTone,
  hasMdmUpload,
  nsvCap,
  setNsvCap,
  MONTH_NAMES,
} from "./programmeCloneUtils";

interface QuickCloneReviewProps {
  programs: Programme[];
  onBack: () => void;
  onPublish: () => void;
  onOpenInWizard: (program: Programme) => void;
}

export function QuickCloneReview({ programs, onBack, onPublish, onOpenInWizard }: QuickCloneReviewProps) {
  // Drafts (one per source programme)
  const [drafts, setDrafts] = useState<Programme[]>(() =>
    programs.map((p) => ({
      ...p,
      name: `${p.name} — Copy`,
      status: "draft",
      kpis: structuredClone(p.kpis),
      gates: { ...p.gates },
      period: { ...p.period },
    })),
  );

  // Batch override controls
  const [batchMonth, setBatchMonth] = useState<string>(String(programs[0]?.period.month ?? 5));
  const [batchYear, setBatchYear] = useState<string>(String(programs[0]?.period.year ?? 2026));
  const [batchMultiplier, setBatchMultiplier] = useState<string>("1");
  const [customMult, setCustomMult] = useState<string>("");

  const applyBatch = () => {
    const month = Number(batchMonth);
    const year = Number(batchYear);
    const mult = batchMultiplier === "custom"
      ? Number(customMult) || 1
      : Number(batchMultiplier);
    setDrafts((ds) =>
      ds.map((d) => {
        let next = { ...d, period: { ...d.period, month, year, isQ1: month <= 3 } };
        const cap = nsvCap(next);
        if (cap !== null && mult !== 1) {
          next = setNsvCap(next, Math.round(cap * mult));
        }
        return next;
      }),
    );
  };

  const updateDraft = (idx: number, patch: Partial<Programme>) => {
    setDrafts((ds) => ds.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const removeRow = (idx: number) => {
    setDrafts((ds) => ds.filter((_, i) => i !== idx));
  };

  const pendingMdm = useMemo(() => drafts.filter(hasMdmUpload).length, [drafts]);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [flashPending, setFlashPending] = useState(false);

  const goToUploads = () => {
    const firstPending = drafts.find(hasMdmUpload);
    if (!firstPending) return;
    const el = rowRefs.current[firstPending.id];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashPending(true);
    window.setTimeout(() => setFlashPending(false), 1800);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
      <div className="border-b border-border bg-card px-6 py-3 shrink-0 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
          <ArrowLeft size={14} /> Back to programmes
        </Button>
        <div className="text-xs text-muted-foreground">
          Quick clone · {drafts.length} programme{drafts.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Sticky batch override row */}
      <div className="bg-card border-b border-border px-6 py-3 sticky top-0 z-10 shrink-0">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Set period for all
            </p>
            <div className="flex gap-2">
              <Select value={batchMonth} onValueChange={setBatchMonth}>
                <SelectTrigger className="h-9 w-[110px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="h-9 w-[90px] text-sm" type="number" value={batchYear} onChange={(e) => setBatchYear(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              NSV cap multiplier
            </p>
            <div className="flex gap-2">
              <Select value={batchMultiplier} onValueChange={setBatchMultiplier}>
                <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Same (×1.00)</SelectItem>
                  <SelectItem value="1.02">×1.02 (+2%)</SelectItem>
                  <SelectItem value="1.05">×1.05 (+5%)</SelectItem>
                  <SelectItem value="1.1">×1.10 (+10%)</SelectItem>
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
              {batchMultiplier === "custom" && (
                <Input className="h-9 w-[80px] text-sm" type="number" step="0.01" placeholder="e.g. 1.07"
                  value={customMult} onChange={(e) => setCustomMult(e.target.value)} />
              )}
            </div>
          </div>
          <Button size="sm" onClick={applyBatch}>Apply to all</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 w-8"></th>
                  <th className="text-left px-3 py-2.5">Programme</th>
                  <th className="text-left px-3 py-2.5">Period</th>
                  <th className="text-right px-3 py-2.5">NSV cap</th>
                  <th className="text-right px-3 py-2.5">Max earning</th>
                  <th className="text-left px-3 py-2.5">Feeds</th>
                  <th className="text-right px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, idx) => {
                  const cap = nsvCap(d);
                  const mdm = hasMdmUpload(d);
                  return (
                    <tr
                      key={d.id}
                      ref={(el) => { rowRefs.current[d.id] = el; }}
                      className={cn(
                        "border-t border-border align-middle transition-colors",
                        flashPending && mdm && "bg-amber-50 ring-1 ring-amber-300",
                      )}
                    >
                      <td className="px-3 py-3"><Checkbox defaultChecked /></td>
                      <td className="px-3 py-3 max-w-[280px]">
                        <div className="font-medium text-foreground text-sm truncate">{d.name}</div>
                        <Badge variant="outline" className={cn("mt-1 text-[10px]", channelTone(d.channel))}>
                          {formatType(d)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Select
                            value={String(d.period.month)}
                            onValueChange={(v) => updateDraft(idx, { period: { ...d.period, month: Number(v) } })}
                          >
                            <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MONTH_NAMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            className="h-8 w-[72px] text-xs"
                            value={d.period.year}
                            onChange={(e) => updateDraft(idx, { period: { ...d.period, year: Number(e.target.value) } })}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {cap !== null ? (
                          <Input
                            type="number"
                            className="h-8 w-[110px] text-xs text-right ml-auto tabular-nums"
                            value={cap}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setDrafts((ds) => ds.map((row, i) => (i === idx ? setNsvCap(row, v) : row)));
                            }}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-sm tabular-nums">
                        ₹{d.maxMonthlyEarning.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        {mdm ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={11} /> Upload needed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 size={12} /> Ready
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenInWizard(d)} title="Edit in wizard">
                            <Pencil size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(idx)} title="Remove from batch">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Total programmes: <span className="font-semibold text-foreground tabular-nums">{drafts.length}</span></div>
              <div>
                MDM uploads pending:{" "}
                <span className={cn("font-semibold tabular-nums", pendingMdm > 0 ? "text-amber-700" : "text-foreground")}>
                  {pendingMdm}
                </span>
                {pendingMdm > 0 && (
                  <button
                    type="button"
                    onClick={goToUploads}
                    className="ml-2 text-primary underline-offset-2 hover:underline"
                  >
                    Go to uploads
                  </button>
                )}
              </div>
            </div>
            <Button
              className="gap-2"
              disabled={pendingMdm > 0 || drafts.length === 0}
              onClick={onPublish}
            >
              <Rocket size={14} /> Publish all ({drafts.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
