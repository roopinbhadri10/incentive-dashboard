import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Trash2, Users, Lock, Info, Pencil, FolderPlus, ChevronDown, ChevronRight,
  Layers, X, Search, Sparkles, GripVertical,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ProgramKpi, KpiGroup, AudienceV2State } from "../builderState";
import { AudienceContextChip } from "../AudienceContextChip";
import {
  KPI_TEMPLATES, KPI_TEMPLATE_MAP, kpiDisplayName, type KpiTemplateId,
} from "@/components/kpi-library/registry";

interface Props {
  value: ProgramKpi[];
  onChange: (v: ProgramKpi[]) => void;
  groups?: KpiGroup[];
  onGroupsChange?: (v: KpiGroup[]) => void;
  channels?: string[];
  audience?: AudienceV2State;
  lockedRole?: "mr" | "aso";
  autoOpenAdd?: boolean;
  onAutoOpenAddHandled?: () => void;
}

const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ─── Earning Basis selector ────────────────────────────────────────────────
const ROLE_AWARE: Record<string, { own: string; juniors: string } | undefined> = {
  eco: { own: "mr", juniors: "aso_ase" },
  tlsd: { own: "mr", juniors: "aso_ase" },
  dbb: { own: "mr", juniors: "aso_ase" },
  qnsv: { own: "MR", juniors: "ASO" },
};

function EarningBasisSelector({
  templateId, config, lockedRole, onChange,
}: {
  templateId: KpiTemplateId;
  config: unknown;
  lockedRole?: "mr" | "aso";
  onChange: (cfg: unknown) => void;
}) {
  const map = ROLE_AWARE[templateId];
  if (!map) return null;
  const isLeaf = lockedRole === "mr";
  const cfg = (config ?? {}) as { role?: string; rateMultiplier?: number };
  const current = cfg.role === map.juniors ? "juniors" : "own";
  const setBasis = (basis: "own" | "juniors") => {
    onChange({ ...cfg, role: basis === "juniors" ? map.juniors : map.own });
  };
  if (isLeaf) {
    return (
      <Card className="p-3 flex items-start gap-2 bg-muted/30">
        <Lock size={14} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs">
          <div className="font-medium">Earning basis: Own achievement (slab-based)</div>
          <div className="text-muted-foreground">
            MR is a leaf-level role with no juniors, so this KPI must pay out on the user's own achievement.
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Users size={12} className="text-muted-foreground" />
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Earning basis</Label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => setBasis("own")} className={cn(
          "text-left p-3 rounded-md border transition",
          current === "own" ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
          <div className="text-sm font-medium">Own achievement (slabs)</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Pays out from this user's own slab structure.</div>
        </button>
        <button type="button" onClick={() => setBasis("juniors")} className={cn(
          "text-left p-3 rounded-md border transition",
          current === "juniors" ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
          <div className="text-sm font-medium">Junior MRs' average earning</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Rate × average earning of the MRs reporting to this manager.</div>
        </button>
      </div>
      {current === "juniors" && templateId !== "qnsv" && (
        <div className="flex items-center gap-2 pt-1">
          <Label className="text-[11px] text-muted-foreground">Multiplier</Label>
          <Input type="number" value={cfg.rateMultiplier ?? 3}
            onChange={(e) => onChange({ ...cfg, rateMultiplier: Number(e.target.value) })}
            className="h-8 w-20" />
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Info size={11} /> Earning = multiplier × Avg MR earning under this manager.
          </span>
        </div>
      )}
    </Card>
  );
}

// ─── Add KPI sheet (supports multi-channel fan-out + multi-group target) ───
function AddKpiSheet({
  open, onOpenChange, value, onAdd, channels, groups, defaultGroupId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: ProgramKpi[];
  onAdd: (kpis: ProgramKpi[]) => void;
  channels: string[];
  groups: KpiGroup[];
  defaultGroupId?: string;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<KpiTemplateId | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>(defaultGroupId ? [defaultGroupId] : []);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // When the sheet opens (e.g. via "Add KPI to group"), seed the group target from
  // defaultGroupId. The sheet stays mounted, so without this the first add lands
  // ungrouped — the initial state was captured before any group was chosen.
  useEffect(() => {
    if (open) {
      setGroupIds(defaultGroupId ? [defaultGroupId] : []);
      setSelectedTemplate(null);
      setSelectedChannels([]);
    }
  }, [open, defaultGroupId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    KPI_TEMPLATES.forEach((t) => set.add(t.tag));
    return ["All", ...Array.from(set)];
  }, []);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return KPI_TEMPLATES.filter((t) => {
      if (categoryFilter !== "All" && t.tag !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
      );
    });
  }, [search, categoryFilter]);

  const reset = () => {
    setSelectedTemplate(null);
    setSelectedChannels([]);
    setGroupIds(defaultGroupId ? [defaultGroupId] : []);
  };

  // Templates that already occupy the current target bucket(s): the Ungrouped
  // bucket when no group is selected, otherwise any of the selected groups
  // (a new KPI is shared across all selected groups, so a clash in any one of
  // them makes the add a duplicate). Used to disable them in the list below.
  const targetExistingTemplates = useMemo(() => {
    const inTarget = groupIds.length === 0
      ? (k: ProgramKpi) => !k.groupIds || k.groupIds.length === 0
      : (k: ProgramKpi) => (k.groupIds ?? []).some((g) => groupIds.includes(g));
    return new Set(value.filter(inTarget).map((k) => k.templateId));
  }, [value, groupIds]);

  const handleAdd = () => {
    if (!selectedTemplate) return;
    if (targetExistingTemplates.has(selectedTemplate)) return; // already in target bucket
    const tpl = KPI_TEMPLATE_MAP[selectedTemplate];
    const buildOne = (channel?: string): ProgramKpi => ({
      templateId: selectedTemplate,
      instanceId: uid("inst"),
      config: tpl.defaultConfig(),
      groupIds: groupIds.length ? [...groupIds] : undefined,
      scope: channel ? { channels: [channel] } : undefined,
    });
    const newKpis = selectedChannels.length > 0
      ? selectedChannels.map((c) => buildOne(c))
      : [buildOne()];
    onAdd(newKpis);
    reset();
    onOpenChange(false);
  };

  const toggleChannel = (c: string) => {
    setSelectedChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };
  const toggleGroup = (gid: string) => {
    setGroupIds((prev) =>
      prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid]);
  };

  const selectedTpl = selectedTemplate ? KPI_TEMPLATE_MAP[selectedTemplate] : null;

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="w-[480px] sm:max-w-[480px] max-w-[92vw] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0 space-y-1">
          <SheetTitle className="text-base">Add KPI</SheetTitle>
          <p className="text-xs text-muted-foreground">Browse the KPI library and configure how it scores for this programme.</p>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
              {groups.length > 0 && (
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Add into groups
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Pick one or more groups, or leave empty to add as ungrouped.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <button type="button" onClick={() => setGroupIds([])}
                      className={cn("px-2.5 py-1 rounded-md border text-xs transition",
                        groupIds.length === 0 ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                      Ungrouped
                    </button>
                    {groups.map((g) => {
                      const on = groupIds.includes(g.id);
                      return (
                        <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                          className={cn("px-2.5 py-1 rounded-md border text-xs transition inline-flex items-center gap-1",
                            on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                          <Layers size={11} /> {g.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Channel scope — always visible so it's never hidden behind a KPI selection */}
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Channel scope
                </Label>
                {channels.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    No channels defined yet for this programme. Add channels in the{" "}
                    <span className="font-medium text-foreground">Basics</span> step to scope this KPI to a specific outlet type.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Leave empty to apply to <span className="font-medium">all channels</span>, or pick one or more to create a separate KPI instance per channel.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {channels.map((c) => {
                        const on = selectedChannels.includes(c);
                        return (
                          <button key={c} type="button" onClick={() => toggleChannel(c)}
                            className={cn("px-2.5 py-1 rounded-md border text-xs transition",
                              on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    {selectedChannels.length > 1 && (
                      <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Info size={11} />
                        Will create <span className="font-medium text-foreground">{selectedChannels.length}</span> KPI instances — one per selected channel.
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search KPIs by name or category…"
                    className="h-9 pl-8 text-xs"
                  />
                </div>

                <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {categories.map((c) => {
                    const active = categoryFilter === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategoryFilter(c)}
                        className={cn(
                          "shrink-0 px-2.5 py-1 rounded-full border text-[11px] transition whitespace-nowrap",
                          active
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:bg-muted text-muted-foreground",
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>


                <div className="space-y-1.5 mt-3">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
                      No KPIs match your search.
                    </div>
                  ) : filteredTemplates.map((t) => {
                    const disabled = targetExistingTemplates.has(t.id);
                    const active = selectedTemplate === t.id;
                    return (
                      <button key={t.id} onClick={() => !disabled && setSelectedTemplate(t.id)} disabled={disabled}
                        className={cn("w-full text-left px-3 py-2.5 rounded-md border transition",
                          disabled ? "opacity-40 cursor-not-allowed"
                            : active ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted hover:border-muted-foreground/20")}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium leading-tight flex items-center gap-1.5 flex-wrap">
                              {t.id === "ai_recommended_order" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                                  <Sparkles size={10} /> AI-Powered Order
                                </span>
                              ) : (
                                t.name
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 leading-snug">{t.description}</div>
                            {disabled && <div className="text-[10px] text-primary mt-1">Already added {groupIds.length === 0 ? "(ungrouped)" : "to selected group"}</div>}
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">{t.tag}</Badge>
                        </div>
                      </button>

                    );
                  })}
                </div>
              </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border bg-background px-6 py-3 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground truncate min-w-0">
            {selectedTpl ? (
              <>Selected: <span className="font-medium text-foreground">{selectedTpl.name}</span></>
            ) : (
              "Select a KPI from the list to configure it."
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!selectedTemplate}>
              Add {selectedChannels.length > 1 ? `(${selectedChannels.length})` : ""}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


// ─── Group edit dialog ────────────────────────────────────────────────────
function GroupDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: KpiGroup;
  onSave: (g: KpiGroup) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cap, setCap] = useState<string>(initial?.combinedMaxPayout?.toString() ?? "");
  const [note, setNote] = useState(initial?.groupGateNote ?? "");

  // Reset when opening
  useMemo(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setCap(initial?.combinedMaxPayout?.toString() ?? "");
      setNote(initial?.groupGateNote ?? "");
    }
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? uid("grp"),
      name: name.trim(),
      description: description.trim() || undefined,
      combinedMaxPayout: cap.trim() ? Number(cap) : undefined,
      groupGateNote: note.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit group" : "New KPI group"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Group name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Channel Focus, Team Earning" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what this bundle covers" className="text-sm" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Combined max payout (₹)</Label>
              <Input type="number" value={cap} onChange={(e) => setCap(e.target.value)}
                placeholder="e.g. 2000" />
              <p className="text-[10px] text-muted-foreground">Caps total payout across this group's KPIs.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gate note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)}
                placeholder='e.g. "Calc after Jun"' />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!name.trim()}>{initial ? "Save" : "Create group"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── KPI row in the left rail ──────────────────────────────────────────────
function KpiRow({
  k, active, onClick, onRemove, channels, groups, onToggleGroup, onScopeChange,
  onDragStart, onDragEnd, onDropOnRow, isDragging, dropIndicator,
}: {
  k: ProgramKpi;
  active: boolean;
  onClick: () => void;
  onRemove: () => void;
  channels: string[];
  groups: KpiGroup[];
  onToggleGroup: (groupId: string, on: boolean) => void;
  onScopeChange: (channels: string[]) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOnRow: (position: "before" | "after") => void;
  isDragging: boolean;
  dropIndicator: "before" | "after" | null;
}) {
  const tpl = KPI_TEMPLATE_MAP[k.templateId];
  const max = tpl.maxPayout(k.config);
  const scopedChannels = k.scope?.channels ?? [];
  const memberGroupIds = k.groupIds ?? [];
  const [hoverPos, setHoverPos] = useState<"before" | "after" | null>(null);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={() => { onDragEnd(); setHoverPos(null); }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverPos(e.clientY - rect.top < rect.height / 2 ? "before" : "after");
      }}
      onDragLeave={() => setHoverPos(null)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropOnRow(hoverPos ?? "after");
        setHoverPos(null);
      }}
      onClick={onClick}
      className={cn(
        "flex items-start gap-1.5 p-2 rounded-md border cursor-pointer transition relative",
        active ? "border-primary bg-sidebar-accent" : "hover:bg-muted",
        isDragging && "opacity-40",
        (dropIndicator ?? hoverPos) === "before" && "before:absolute before:left-0 before:right-0 before:-top-[2px] before:h-[2px] before:bg-primary before:rounded",
        (dropIndicator ?? hoverPos) === "after" && "after:absolute after:left-0 after:right-0 after:-bottom-[2px] after:h-[2px] after:bg-primary after:rounded",
      )}
    >
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-0.5 -ml-0.5 shrink-0"
        title="Drag to reorder or move between groups"
      >
        <GripVertical size={12} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{kpiDisplayName(k.templateId, k.customName)}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{tpl.tag}</Badge>
          {scopedChannels.length > 0
            ? scopedChannels.map((c) => (
              <Badge key={c} variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary">
                {c}
              </Badge>
            ))
            : channels.length > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">All channels</Badge>
            )}
          {memberGroupIds.length > 1 && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">
              in {memberGroupIds.length} groups
            </Badge>
          )}
          {max != null && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{fmt(max)}</Badge>
          )}
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground p-0.5">
              <ChevronDown size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {channels.length > 0 && (
              <>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Channel scope
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onScopeChange([]); }}
                  className="text-xs gap-2">
                  <Checkbox checked={scopedChannels.length === 0} className="pointer-events-none" />
                  All channels
                </DropdownMenuItem>
                {channels.map((c) => {
                  const on = scopedChannels.includes(c);
                  return (
                    <DropdownMenuItem key={c} onSelect={(e) => {
                      e.preventDefault();
                      onScopeChange(on ? scopedChannels.filter((x) => x !== c) : [...scopedChannels, c]);
                    }} className="text-xs gap-2">
                      <Checkbox checked={on} className="pointer-events-none" />
                      {c}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
              </>
            )}
            {groups.length > 0 && (
              <>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Groups (multi-select)
                </DropdownMenuLabel>
                {groups.map((g) => {
                  const on = memberGroupIds.includes(g.id);
                  return (
                    <DropdownMenuItem key={g.id} onSelect={(e) => {
                      e.preventDefault();
                      onToggleGroup(g.id, !on);
                    }} className="text-xs gap-2">
                      <Checkbox checked={on} className="pointer-events-none" />
                      <Layers size={11} /> {g.name}
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="text-muted-foreground hover:text-destructive p-0.5">
        <Trash2 size={12} />
      </button>
    </div>
  );
}


// ─── Main step ─────────────────────────────────────────────────────────────
export function ProgramKpiStep({
  value, onChange, groups = [], onGroupsChange, channels = [], audience, lockedRole,
  autoOpenAdd, onAutoOpenAddHandled,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(value[0]?.instanceId ?? null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaultGroupId, setAddDefaultGroupId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (autoOpenAdd) {
      setAddDefaultGroupId(undefined);
      setAddOpen(true);
      onAutoOpenAddHandled?.();
    }
  }, [autoOpenAdd, onAutoOpenAddHandled]);
  const [groupDialog, setGroupDialog] = useState<{ open: boolean; editing?: KpiGroup }>({ open: false });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const active = value.find((k) => k.instanceId === activeId) ?? null;
  const ActiveComp = active ? KPI_TEMPLATE_MAP[active.templateId].Component : null;

  const ungrouped = value.filter((k) => !k.groupIds || k.groupIds.length === 0);
  const byGroup = (gid: string) => value.filter((k) => (k.groupIds ?? []).includes(gid));

  // ─── Drag & drop: reorder KPIs and move them between groups ───────────────
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // group id or "__ungrouped__"

  // Two KPIs collide inside a group when they share a template and the same
  // channel scope (per-channel fan-out of one template is still distinct).
  const dupKey = (k: ProgramKpi) =>
    `${k.templateId}|${[...(k.scope?.channels ?? [])].sort().join(",")}`;

  // True if a KPI belongs to the given destination bucket — a real group id, or
  // `null` for the "Ungrouped" bucket (no group memberships).
  const inBucket = (k: ProgramKpi, destGroupId: string | null) =>
    destGroupId === null
      ? !k.groupIds || k.groupIds.length === 0
      : (k.groupIds ?? []).includes(destGroupId);

  // True if dropping `src` into the destination bucket (a group, or the
  // Ungrouped bucket) would duplicate a KPI that's already there. Reordering
  // within a bucket src already belongs to is allowed — we only guard genuine
  // moves into a new one.
  const wouldDuplicateInGroup = (src: ProgramKpi, destGroupId: string | null | undefined) => {
    const dest = destGroupId ?? null;
    if (inBucket(src, dest)) return false; // already a member — reorder, don't block
    const key = dupKey(src);
    return value.some(
      (k) => k.instanceId !== src.instanceId && inBucket(k, dest) && dupKey(k) === key,
    );
  };

  const duplicateToast = (src: ProgramKpi, destGroupId: string | null) => {
    const where = destGroupId === null ? "ungrouped" : "this group";
    toast.error(`${kpiDisplayName(src.templateId, src.customName)} is already ${where}.`);
  };

  const moveKpi = (
    srcId: string,
    opts: { beforeId?: string; afterId?: string; intoGroupId?: string | null },
  ) => {
    const src = value.find((k) => k.instanceId === srcId);
    if (!src) return;
    const without = value.filter((k) => k.instanceId !== srcId);
    if (opts.beforeId || opts.afterId) {
      const refId = opts.beforeId ?? opts.afterId!;
      const ref = value.find((k) => k.instanceId === refId);
      if (!ref) return;
      // Adopt the target row's group context (single-group semantics for DnD).
      const destGroupId = ref.groupIds?.[0] ?? null;
      if (wouldDuplicateInGroup(src, destGroupId)) {
        duplicateToast(src, destGroupId);
        return;
      }
      const updated: ProgramKpi = { ...src, groupIds: ref.groupIds ? [...ref.groupIds] : undefined };
      const idx = without.findIndex((k) => k.instanceId === refId);
      const insertAt = opts.beforeId ? idx : idx + 1;
      onChange([...without.slice(0, insertAt), updated, ...without.slice(insertAt)]);
      return;
    }
    if (opts.intoGroupId !== undefined) {
      if (wouldDuplicateInGroup(src, opts.intoGroupId)) {
        duplicateToast(src, opts.intoGroupId ?? null);
        return;
      }
      const updated: ProgramKpi = { ...src, groupIds: opts.intoGroupId ? [opts.intoGroupId] : undefined };
      onChange([...without, updated]);
    }
  };

  const handleRowDrop = (targetKpiId: string, position: "before" | "after") => {
    if (!dragId || dragId === targetKpiId) return;
    moveKpi(dragId, position === "before" ? { beforeId: targetKpiId } : { afterId: targetKpiId });
    setDragId(null);
    setDropTarget(null);
  };

  const handleContainerDrop = (gid: string | null) => {
    if (!dragId) return;
    moveKpi(dragId, { intoGroupId: gid });
    setDragId(null);
    setDropTarget(null);
  };

  const addKpis = (newKpis: ProgramKpi[]) => {
    // Apply role default per template
    const stamped = newKpis.map((k) => {
      const cfg = k.config as { role?: string };
      const map = ROLE_AWARE[k.templateId];
      if (map && lockedRole === "aso") cfg.role = map.juniors;
      else if (map && lockedRole === "mr") cfg.role = map.own;
      return { ...k, config: cfg };
    });
    onChange([...value, ...stamped]);
    setActiveId(stamped[0]?.instanceId ?? activeId);
  };

  const updateActive = (config: unknown) => {
    if (!active) return;
    onChange(value.map((k) => (k.instanceId === active.instanceId ? { ...k, config } : k)));
  };

  const removeKpi = (id: string) => {
    const next = value.filter((k) => k.instanceId !== id);
    onChange(next);
    if (activeId === id) setActiveId(next[0]?.instanceId ?? null);
  };

  const toggleGroupMembership = (kpiId: string, groupId: string, on: boolean) => {
    const src = value.find((k) => k.instanceId === kpiId);
    if (on && src && wouldDuplicateInGroup(src, groupId)) {
      toast.error(`${kpiDisplayName(src.templateId, src.customName)} is already in this group.`);
      return;
    }
    onChange(value.map((k) => {
      if (k.instanceId !== kpiId) return k;
      const cur = k.groupIds ?? [];
      const next = on
        ? (cur.includes(groupId) ? cur : [...cur, groupId])
        : cur.filter((g) => g !== groupId);
      return { ...k, groupIds: next.length ? next : undefined };
    }));
  };

  const updateScope = (kpiId: string, chans: string[]) => {
    onChange(value.map((k) => k.instanceId === kpiId
      ? { ...k, scope: chans.length ? { channels: chans } : undefined }
      : k));
  };

  const saveGroup = (g: KpiGroup) => {
    if (!onGroupsChange) return;
    const exists = groups.some((x) => x.id === g.id);
    onGroupsChange(exists ? groups.map((x) => x.id === g.id ? g : x) : [...groups, g]);
  };

  const removeGroup = (gid: string) => {
    if (!onGroupsChange) return;
    onGroupsChange(groups.filter((g) => g.id !== gid));
    // Detach its KPIs (don't delete them) — drop this group id from membership
    onChange(value.map((k) => {
      const cur = k.groupIds ?? [];
      if (!cur.includes(gid)) return k;
      const next = cur.filter((x) => x !== gid);
      return { ...k, groupIds: next.length ? next : undefined };
    }));
  };


  const totalMax = value.reduce((sum, k) => {
    const m = KPI_TEMPLATE_MAP[k.templateId].maxPayout(k.config);
    return sum + (m ?? 0);
  }, 0);

  const groupSum = (gid: string) =>
    byGroup(gid).reduce((s, k) => s + (KPI_TEMPLATE_MAP[k.templateId].maxPayout(k.config) ?? 0), 0);

  const openAdd = (gid?: string) => { setAddDefaultGroupId(gid); setAddOpen(true); };

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-xl font-semibold">KPI configuration</h2>
        <p className="text-sm text-muted-foreground">
          Pick KPIs from the library, optionally bundle them into groups (e.g. "Channel Focus") and scope each one to specific channels.
        </p>
        {audience && <AudienceContextChip audience={audience} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        <Card className="p-3 h-fit">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-sm font-medium">Your KPIs</span>
            <div className="flex items-center gap-1">
              {onGroupsChange && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => setGroupDialog({ open: true })}>
                  <FolderPlus size={12} /> Group
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => openAdd(undefined)}>
                <Plus size={12} /> Add KPI
              </Button>
            </div>
          </div>

          {value.length === 0 && groups.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
              No KPIs yet — click "Add KPI" to start
            </div>
          ) : (
            <div className="space-y-3">
              {/* Groups */}
              {groups.map((g) => {
                const items = byGroup(g.id);
                const sum = groupSum(g.id);
                const overCap = g.combinedMaxPayout != null && sum > g.combinedMaxPayout;
                const isCollapsed = collapsed[g.id];
                return (
                  <div
                    key={g.id}
                    className={cn(
                      "rounded-md border border-border bg-muted/30 transition",
                      dropTarget === g.id && "ring-2 ring-primary border-primary/60",
                    )}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDropTarget(g.id);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setDropTarget((t) => (t === g.id ? null : t));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleContainerDrop(g.id);
                    }}
                  >
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <button onClick={() => setCollapsed((s) => ({ ...s, [g.id]: !s[g.id] }))}
                        className="text-muted-foreground hover:text-foreground">
                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <Layers size={12} className="text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{g.name}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{items.length} KPI{items.length === 1 ? "" : "s"}</Badge>
                          <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", overCap && "border-amber-500 text-amber-700")}>
                            {fmt(sum)}{g.combinedMaxPayout != null ? ` / ${fmt(g.combinedMaxPayout)} cap` : ""}
                          </Badge>
                          {g.groupGateNote && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">{g.groupGateNote}</Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-muted-foreground hover:text-foreground p-0.5">
                            <ChevronDown size={12} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openAdd(g.id)} className="text-xs gap-1.5">
                            <Plus size={11} /> Add KPI to group
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setGroupDialog({ open: true, editing: g })} className="text-xs gap-1.5">
                            <Pencil size={11} /> Edit group
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => removeGroup(g.id)} className="text-xs gap-1.5 text-destructive">
                            <Trash2 size={11} /> Remove group (keep KPIs)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {!isCollapsed && (
                      <div className="px-2 pb-2 space-y-1.5">
                        {items.length === 0 ? (
                          <button onClick={() => openAdd(g.id)}
                            className="w-full text-xs text-muted-foreground italic py-2 border border-dashed rounded-md hover:bg-muted">
                            + Add KPI to this group
                          </button>
                        ) : items.map((k) => (
                          <KpiRow key={k.instanceId} k={k}
                            active={activeId === k.instanceId}
                            onClick={() => setActiveId(k.instanceId)}
                            onRemove={() => removeKpi(k.instanceId)}
                            channels={channels}
                            groups={groups}
                            onToggleGroup={(gid, on) => toggleGroupMembership(k.instanceId, gid, on)}
                            onScopeChange={(chans) => updateScope(k.instanceId, chans)}
                            onDragStart={() => setDragId(k.instanceId)}
                            onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                            onDropOnRow={(pos) => handleRowDrop(k.instanceId, pos)}
                            isDragging={dragId === k.instanceId}
                            dropIndicator={null}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ungrouped */}
              {(ungrouped.length > 0 || (groups.length > 0 && dragId)) && (
                <div
                  className={cn(
                    "space-y-1.5 rounded-md transition p-1",
                    dropTarget === "__ungrouped__" && "ring-2 ring-primary",
                  )}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTarget("__ungrouped__");
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDropTarget((t) => (t === "__ungrouped__" ? null : t));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleContainerDrop(null);
                  }}
                >
                  {groups.length > 0 && (
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">Ungrouped</div>
                  )}
                  {ungrouped.length === 0 && (
                    <div className="text-[11px] italic text-muted-foreground text-center py-3 border border-dashed rounded-md">
                      Drop here to remove from group
                    </div>
                  )}
                  {ungrouped.map((k) => (
                    <KpiRow key={k.instanceId} k={k}
                      active={activeId === k.instanceId}
                      onClick={() => setActiveId(k.instanceId)}
                      onRemove={() => removeKpi(k.instanceId)}
                      channels={channels}
                      groups={groups}
                      onToggleGroup={(gid, on) => toggleGroupMembership(k.instanceId, gid, on)}
                      onScopeChange={(chans) => updateScope(k.instanceId, chans)}
                      onDragStart={() => setDragId(k.instanceId)}
                      onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                      onDropOnRow={(pos) => handleRowDrop(k.instanceId, pos)}
                      isDragging={dragId === k.instanceId}
                      dropIndicator={null}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t mt-3 pt-2 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Total max payout</span>
            <span className="font-semibold">{fmt(totalMax)}</span>
          </div>
        </Card>

        <div className="space-y-3">
          {active && ActiveComp ? (
            <>
              <KpiNameEditor
                templateName={KPI_TEMPLATE_MAP[active.templateId].name}
                value={active.customName ?? ""}
                onChange={(name) =>
                  onChange(value.map((k) => (k.instanceId === active.instanceId ? { ...k, customName: name } : k)))
                }
              />
              <Card className="p-3 space-y-3">
                {/* Channel scope */}
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Channel scope
                  </Label>
                  {channels.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      No channels defined. Add channels in the <span className="font-medium text-foreground">Basics</span> step
                      to scope this KPI (e.g. General Trade, Modern Trade).
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <button type="button"
                        onClick={() => updateScope(active.instanceId, [])}
                        className={cn("px-2.5 py-1 rounded-md border text-xs transition",
                          !active.scope?.channels?.length ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                        All channels
                      </button>
                      {channels.map((c) => {
                        const on = active.scope?.channels?.includes(c) ?? false;
                        return (
                          <button key={c} type="button"
                            onClick={() => {
                              const cur = active.scope?.channels ?? [];
                              updateScope(active.instanceId, on ? cur.filter((x) => x !== c) : [...cur, c]);
                            }}
                            className={cn("px-2.5 py-1 rounded-md border text-xs transition",
                              on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Groups (multi-membership) */}
                {groups.length > 0 && (
                  <div>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold inline-flex items-center gap-1">
                      <Layers size={11} className="text-primary" /> Groups
                      <span className="font-normal text-muted-foreground normal-case tracking-normal">(this KPI can be in multiple)</span>
                    </Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {groups.map((g) => {
                        const on = (active.groupIds ?? []).includes(g.id);
                        return (
                          <button key={g.id} type="button"
                            onClick={() => toggleGroupMembership(active.instanceId, g.id, !on)}
                            className={cn("px-2.5 py-1 rounded-md border text-xs transition inline-flex items-center gap-1",
                              on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                            <Layers size={11} /> {g.name}
                            {on && <X size={10} className="ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>

              <EarningBasisSelector
                templateId={active.templateId}
                config={active.config}
                lockedRole={lockedRole}
                onChange={updateActive}
              />
              <ActiveComp value={active.config} onChange={updateActive} hideRoleSelector />
            </>
          ) : (
            <Card className="p-12 text-center text-sm text-muted-foreground border-dashed">
              Add a KPI to start configuring.
            </Card>
          )}
        </div>
      </div>

      <AddKpiSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        value={value}
        onAdd={addKpis}
        channels={channels}
        groups={groups}
        defaultGroupId={addDefaultGroupId}
      />

      <GroupDialog
        open={groupDialog.open}
        onOpenChange={(o) => setGroupDialog({ open: o, editing: o ? groupDialog.editing : undefined })}
        initial={groupDialog.editing}
        onSave={saveGroup}
      />
    </div>
  );
}

/* ─── Per-instance KPI rename ──────────────────────────────────────────── */
function KpiNameEditor({
  templateName, value, onChange,
}: { templateName: string; value: string; onChange: (v: string) => void }) {
  const using = value.trim().length > 0;
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Pencil size={12} className="text-muted-foreground" />
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          KPI name (visible to participants)
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={templateName} className="h-8 text-sm" maxLength={60} />
        {using && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
            onClick={() => onChange("")}>Reset</Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        Standard name: <span className="font-medium text-foreground">{templateName}</span>. Override with your own label
        (e.g. "Gold Coverage", "Power Brand Push") — calculations don't change.
      </p>
    </Card>
  );
}
