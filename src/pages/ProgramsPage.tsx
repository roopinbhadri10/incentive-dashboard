import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Search,
  Copy,
  Pencil,
  Archive,
  MoreHorizontal,
  Plus,
  CalendarDays,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  Lock,
  BarChart3,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveRule, fetchRules } from "@/lib/ruleApi";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchProgramRoles,
  fetchRolePayloadValues,
  fetchRoleDesignations,
} from "@/lib/saleshubApi";
import { ruleToProgramme } from "@/lib/ruleToProgramme";
import type {
  Programme,
  Channel,
  RoleType,
  ProgrammeStatus,
} from "@/types/programme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Aliases (the AudienceChannel type re-exports as Channel from programme) ─
type ChannelType = Channel; // "CCD" | "HCD"

interface ProgramsPageProps {
  onCreateNew: () => void;
  onOpenProgram: (programme: Programme) => void;
  onCloneProgram: (programme: Programme) => void;
  onCloneMultiple: (programIds: string[]) => void;
  onViewAnalytics?: (programId: string) => void;
  onOpenSavedProgram?: (id: string) => void;
  savedPrograms?: Array<{ id: string; name: string; role: string; quarterLabel: string; createdAt: string }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatPeriod(p: Programme["period"]): string {
  return `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

/**
 * Parse a rules-engine creationTime (e.g. "2026-06-16T15:29:41.619282") to a
 * comparable epoch (ms incl. time-of-day). The engine sends microseconds (6
 * fractional digits) which strict browsers reject, so trim sub-millisecond
 * digits first. Returns 0 for missing/invalid values so they sort last.
 */
function toEpoch(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(t) ? 0 : t;
}

function formatRole(role: RoleType): string {
  switch (role) {
    case "MR": return "MR";
    case "ASO_ASE": return "ASO/ASE";
    case "ASO": return "ASO";
    case "ASM": return "ASM";
    // Config-defined roles arrive as ready-to-display labels — show verbatim.
    default: return role;
  }
}

function formatSegment(p: Programme): string | null {
  if (p.geography === "kerala") return "Kerala territory";
  switch (p.segment) {
    case "urban-retail": return "Urban · Retail";
    case "urban-wholesale": return "Urban · Wholesale";
    case "rural-ss": return "Rural (SS)";
    case "hybrid": return "Hybrid";
    case "urban": return "Urban";
    case "rural": return "Rural";
    case "urban-cities": return "Urban cities";
    case "other-markets": return "Other markets";
    case "all": return null;
  }
}

function hasPendingMdmUpload(p: Programme): boolean {
  // Mock heuristic: any enabled KPI on mdm-upload feed counts as pending
  // because no upload has been associated with these mock programmes.
  return Object.values(p.kpis).some(
    (cfg) => cfg?.enabled && cfg.dataFeed === "mdm-upload",
  );
}

function statusPillClasses(status: ProgrammeStatus): string {
  switch (status) {
    case "draft":    return "bg-muted text-muted-foreground border-border";
    case "active":   return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "locked":   return "bg-amber-50 text-amber-800 border-amber-200";
    case "archived": return "bg-muted/50 text-muted-foreground/70 border-border";
  }
}

const CHANNEL_STYLE: Record<ChannelType, { bg: string; fg: string; label: string }> = {
  CCD: { bg: "rgba(0,109,78,0.10)",  fg: "#006D4E", label: "CCD" },
  HCD: { bg: "rgba(72,61,158,0.10)", fg: "#483D9E", label: "HCD" },
};

// ─── Main page ──────────────────────────────────────────────────────────────
export function ProgramsPage({
  onCreateNew,
  onOpenProgram,
  onCloneProgram,
  onCloneMultiple,
  onViewAnalytics,
  onOpenSavedProgram,
  savedPrograms = [],
}: ProgramsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | ChannelType>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "earning" | "period" | "name">("newest");
  const [selected, setSelected] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Roles for the filter are synced from config — the same source the create
  // wizard's Audience step uses (fetchProgramRoles) — so the two lists stay in
  // lock-step instead of drifting from a hardcoded list.
  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    fetchProgramRoles()
      .then(setRoles)
      .catch(() => { /* leave roles empty → only "All roles" shows */ });
  }, []);

  // Programmes are sourced live from the rules engine (GET /v1/rules).
  const {
    data: programmes = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      // Warm the role → marketType/designation reverse-maps before mapping, so
      // ruleToProgramme's role recovery (rolesFromRule) can resolve rules that
      // only carry the role implicitly. Non-fatal: recovery falls back to the
      // verbatim kpiConfig roles, which need no cache.
      const [rules] = await Promise.all([
        fetchRules(),
        fetchRolePayloadValues().catch(() => { /* non-fatal */ }),
        fetchRoleDesignations().catch(() => { /* non-fatal */ }),
      ]);
      return rules.map(ruleToProgramme);
    },
  });

  // Archive a programme via DELETE /v1/rules/{id}, then refetch the list so the
  // row drops out (or re-renders as Ended once the engine reflects it).
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const archiveMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => archiveRule(id),
    onSuccess: (_data, { name }) => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      toast({
        title: "Programme archived",
        description: `“${name}” has been archived.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Couldn't archive programme",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    },
  });

  // Distinct period buckets from data
  const periodOptions = useMemo(() => {
    const set = new Set<string>();
    programmes.forEach((p) => set.add(formatPeriod(p.period)));
    return Array.from(set);
  }, [programmes]);

  const filtered = useMemo(() => {
    const list = programmes.filter((p) => {
      if (
        searchQuery &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.id.toLowerCase().includes(searchQuery.toLowerCase())
      ) return false;
      if (channelFilter !== "all" && p.channel !== channelFilter) return false;
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "archived") {
          if (p.status !== "archived" && p.status !== "locked") return false;
        } else if (p.status !== statusFilter) return false;
      }
      if (periodFilter !== "all" && formatPeriod(p.period) !== periodFilter) return false;
      return true;
    });
    list.sort((a, b) => {
      switch (sortBy) {
        // Newest first by full creation timestamp (date + time); rules with no
        // creationTime sort last.
        case "newest":
          return toEpoch(b.createdAt) - toEpoch(a.createdAt);
        case "earning": return b.maxMonthlyEarning - a.maxMonthlyEarning;
        case "period":
          return (b.period.year - a.period.year) || (b.period.month - a.period.month);
        case "name": return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [programmes, searchQuery, channelFilter, roleFilter, statusFilter, periodFilter, sortBy]);

  // Debug: log the list in the exact order it renders, with the creationTime each
  // row sorts on (and its parsed epoch). If `createdAt` shows "(none)" / epoch 0,
  // the engine's creationTime isn't reaching the row → the newest sort can't work.
  useEffect(() => {
    console.log(`[Programmes] ${filtered.length}/${programmes.length} shown · sort=${sortBy}`);
    console.table(
      filtered.map((p, i) => ({
        "#": i + 1,
        name: p.name,
        createdAt: p.createdAt || "(none)",
        epoch: toEpoch(p.createdAt),
        status: p.status,
      })),
    );
  }, [filtered, programmes.length, sortBy]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const isEmpty = programmes.length === 0;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="bg-card rounded-xl mx-4 mt-4 mb-4 p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-[26px] bg-primary rounded-full" />
              <div>
                <h1 className="text-[22px] font-semibold text-foreground leading-tight">
                  Programmes
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filtered.length} of {programmes.length} programmes
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-9"
              onClick={onCreateNew}
            >
              <Plus size={14} /> New programme
            </Button>
          </div>

          {/* Saved programmes (created via wizard) */}
          {savedPrograms.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your programmes ({savedPrograms.length})</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {savedPrograms.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => onOpenSavedProgram?.(sp.id)}
                    className="text-left p-3 rounded-md border border-border hover:border-primary hover:bg-muted/30 transition"
                  >
                    <div className="text-sm font-medium truncate">{sp.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{sp.role} · {sp.quarterLabel}</div>
                  </button>
                ))}
              </div>
              <div className="h-px bg-border my-2" />
            </div>
          )}

          {/* Loading / error / empty / list */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading programmes…</div>
          ) : isError ? (
            <div className="py-12 text-center text-xs text-destructive">
              Couldn't load programmes{error instanceof Error ? `: ${error.message}` : ""}.
            </div>
          ) : isEmpty ? (
            <EmptyState onCreateNew={onCreateNew} />
          ) : (
            <>
              {/* Status filter pills */}
              <StatusPillBar value={statusFilter} onChange={setStatusFilter} programmes={programmes} />

              {/* Filter / sort bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={channelFilter}
                  onValueChange={(v) => setChannelFilter(v as typeof channelFilter)}
                >
                  <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
                    <SelectValue placeholder="Division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All divisions</SelectItem>
                    <SelectItem value="CCD">CCD</SelectItem>
                    <SelectItem value="HCD">HCD</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={roleFilter}
                  onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}
                >
                  <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Live</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Ended</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-[140px] h-9 text-xs bg-card gap-1.5">
                    <CalendarDays size={12} className="text-muted-foreground" />
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All periods</SelectItem>
                    {periodOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="h-6 w-px bg-border mx-1" />

                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as typeof sortBy)}
                >
                  <SelectTrigger className="w-[170px] h-9 text-xs bg-card gap-1.5">
                    <ArrowUpDown size={12} className="text-muted-foreground" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Sort: Newest</SelectItem>
                    <SelectItem value="earning">Sort: Max earning</SelectItem>
                    <SelectItem value="period">Sort: Period</SelectItem>
                    <SelectItem value="name">Sort: Name</SelectItem>
                  </SelectContent>
                </Select>

                <div className="ml-auto relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search programmes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-xs w-56"
                  />
                </div>
              </div>

              {/* Programme list */}
              <div className="space-y-2">
                {filtered.map((p) => (
                  <ProgrammeRow
                    key={p.id}
                    programme={p}
                    selected={selected.includes(p.id)}
                    expanded={expandedId === p.id}
                    onToggleSelect={() => toggleSelect(p.id)}
                    onToggleExpand={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
                    onEdit={() => onOpenProgram(p)}
                    onClone={() => onCloneProgram(p)}
                    onViewAnalytics={onViewAnalytics ? () => onViewAnalytics(p.id) : undefined}
                    onArchive={() => archiveMutation.mutate({ id: p.id, name: p.name })}
                    isArchiving={archiveMutation.isPending && archiveMutation.variables?.id === p.id}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No programmes match the current filters.
                  </div>
                )}
              </div>
            </>
          )}

          {selected.length > 0 && <div className="h-20" aria-hidden />}
        </div>

        {/* Floating bulk-action bar */}
        <div
          className={cn(
            "pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-200",
            selected.length >= 2
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-3",
          )}
          role="region"
          aria-label="Bulk actions"
        >
          <div className="flex items-center gap-3 bg-foreground text-background rounded-full shadow-2xl border border-border/20 pl-4 pr-1.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold tabular-nums">
                {selected.length}
              </span>
              <span className="text-xs font-medium">selected</span>
            </div>
            <span className="h-5 w-px bg-background/20" />
            <button
              onClick={() => setSelected([])}
              className="text-xs text-background/70 hover:text-background transition-colors px-2"
            >
              Clear
            </button>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-4"
              onClick={() => onCloneMultiple(selected)}
            >
              <Copy size={12} /> Clone {selected.length} selected
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Programme row ──────────────────────────────────────────────────────────
function ProgrammeRow({
  programme,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onEdit,
  onClone,
  onViewAnalytics,
  onArchive,
  isArchiving,
}: {
  programme: Programme;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onClone: () => void;
  onViewAnalytics?: () => void;
  onArchive: () => void;
  isArchiving: boolean;
}) {
  const channel = CHANNEL_STYLE[programme.channel];
  const segmentLabel = formatSegment(programme);
  const pendingMdm = hasPendingMdmUpload(programme);
  const canEdit = programme.status === "draft";
  // Drafts and live programmes can be ended; already-archived ones can't.
  const canArchive = programme.status === "draft" || programme.status === "active";
  const [confirmArchive, setConfirmArchive] = useState(false);

  return (
    <Card
      className={cn(
        "group border transition-all hover:shadow-sm hover:border-primary/30 overflow-hidden",
        selected && "border-primary/50 bg-primary/[0.02]",
        expanded && "border-primary/40 shadow-sm",
      )}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Checkbox — appears on hover or when selected */}
        <div
          className={cn(
            "shrink-0 transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select programme" />
        </div>

        {/* Main content */}
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <p className="text-sm font-semibold text-foreground truncate">
              {programme.name}
            </p>
            {pendingMdm && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-orange-500 shrink-0"
                    aria-label="MDM upload pending"
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  MDM upload pending
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide"
              style={{ backgroundColor: channel.bg, color: channel.fg }}
            >
              {channel.label}
            </span>
            {programme.role && (
              <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 h-[18px]">
                {formatRole(programme.role)}
              </Badge>
            )}
            {segmentLabel && (
              <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0 h-[18px]">
                {segmentLabel}
              </Badge>
            )}
            {programme.geography === "kerala" && (
              <span className="inline-flex items-center px-1.5 h-[18px] rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Kerala
              </span>
            )}
            <span className="mx-0.5 text-border">·</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays size={11} />
              {formatPeriod(programme.period)}
            </span>
          </div>
        </button>

        {/* Right meta: status + earning */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden md:block">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Max / month
            </p>
            <p className="text-sm font-semibold text-foreground tabular-nums inline-flex items-center gap-1">
              <TrendingUp size={12} className="text-primary" />
              ₹{programme.maxMonthlyEarning.toLocaleString()}
            </p>
          </div>

          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize",
              statusPillClasses(programme.status),
            )}
          >
            {programme.status}
          </span>

          {/* Hover actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClone}>
                  <Copy size={13} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clone</TooltipContent>
            </Tooltip>
          </div>

          {/* Expand chevron */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onToggleExpand}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronDown
              size={14}
              className={cn("transition-transform", expanded && "rotate-180")}
            />
          </Button>

          {/* 3-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {onViewAnalytics && (
                <DropdownMenuItem onClick={onViewAnalytics} className="gap-2 text-xs">
                  <BarChart3 size={12} /> View analytics
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs">
                  <Pencil size={12} /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onClone} className="gap-2 text-xs">
                <Copy size={12} /> Clone
              </DropdownMenuItem>
              {canArchive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      // Keep the menu's close-on-select, but defer opening the
                      // dialog so it doesn't race the dropdown's unmount.
                      e.preventDefault();
                      setConfirmArchive(true);
                    }}
                    disabled={isArchiving}
                    className="gap-2 text-xs text-destructive focus:text-destructive"
                  >
                    <Archive size={12} /> Archive
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Archive confirmation */}
          <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this programme?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{programme.name}” will be archived in the incentive engine and removed
                  from the active list. This can't be undone here.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onArchive}
                  disabled={isArchiving}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isArchiving ? "Archiving…" : "Archive"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {expanded && <ProgrammeExpandedDetails programme={programme} onEdit={onEdit} canEdit={canEdit} />}
    </Card>
  );
}

// ─── Expanded performance details ───────────────────────────────────────────
const KPI_LABELS: Record<string, string> = {
  A_nsv: "Net Sales Value",
  B_phasing: "Sales Phasing",
  C_eco: "Effective Coverage",
  D_tlsd: "TLSD",
  E_dbb: "Must-sell Brand Billing",
  F_cft: "Field Time Compliance",
  G_subDbBilling: "Sub-DB Billing",
  H_msb: "Must-Sell SKUs",
  I_channelFocus: "Channel Focus",
  J_teamEarning: "Team Earning",
  K_appUsage: "App Usage",
  L_quarterly: "Quarterly NSV",
};

// Deterministic pseudo-random based on string id — keeps mock attainment stable per programme
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function mockAttainment(programmeId: string, kpiKey: string): number {
  const n = hashSeed(programmeId + kpiKey);
  // Range 45 – 118
  return 45 + (n % 74);
}

const DONUT_PALETTE = [
  "hsl(174, 100%, 32%)", // primary teal
  "hsl(210, 70%, 55%)",
  "hsl(280, 50%, 58%)",
  "hsl(30, 85%, 55%)",
  "hsl(350, 65%, 58%)",
  "hsl(140, 55%, 45%)",
  "hsl(45, 90%, 50%)",
  "hsl(255, 60%, 60%)",
  "hsl(15, 75%, 55%)",
  "hsl(195, 65%, 50%)",
  "hsl(320, 55%, 55%)",
  "hsl(95, 50%, 45%)",
];

function suggestionFor(label: string, attainment: number): string {
  if (attainment >= 100) return "Exceeding target — protect this momentum.";
  if (attainment >= 90) return "On track — keep current cadence.";
  if (attainment >= 70) return `Push ${label} with a targeted nudge to the bottom-quartile reps.`;
  return `${label} is critically low — review slab thresholds or run a focused 7-day sprint.`;
}

function ProgrammeExpandedDetails({
  programme,
  onEdit,
  canEdit,
}: {
  programme: Programme;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const enabledKpis = Object.entries(programme.kpis).filter(
    ([, cfg]) => cfg?.enabled,
  );

  const kpiPerf = enabledKpis.map(([key], idx) => ({
    key,
    label: KPI_LABELS[key] ?? key,
    attainment: mockAttainment(programme.id, key),
    color: DONUT_PALETTE[idx % DONUT_PALETTE.length],
  }));

  const overall = kpiPerf.length
    ? Math.round(kpiPerf.reduce((s, k) => s + k.attainment, 0) / kpiPerf.length)
    : 0;
  const estPayout = Math.round(programme.maxMonthlyEarning * (overall / 100));
  const underperformers = kpiPerf
    .filter((k) => k.attainment < 70)
    .sort((a, b) => a.attainment - b.attainment);
  const topPerformer = kpiPerf.slice().sort((a, b) => b.attainment - a.attainment)[0];

  // Donut geometry — equal segments, tinted by attainment
  const size = 168;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const segPct = kpiPerf.length ? 1 / kpiPerf.length : 0;
  const gapPx = 2;
  const segLen = Math.max(0, segPct * circumference - gapPx);

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
      {/* Lock notice for non-draft programmes */}
      {!canEdit && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-card border border-border rounded-md px-3 py-1.5">
          <Lock size={11} />
          This programme is {programme.status} — editing is locked. You can view, clone, or act on the insights below.
        </div>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatTile
          label="Overall attainment"
          value={`${overall}%`}
          accent={overall >= 90 ? "good" : overall >= 70 ? "warn" : "bad"}
          icon={
            overall >= 90 ? (
              <CheckCircle2 size={14} />
            ) : overall >= 70 ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )
          }
        />
        <StatTile
          label="Estimated payout"
          value={`₹${estPayout.toLocaleString("en-IN")}`}
          sub={`of ₹${programme.maxMonthlyEarning.toLocaleString("en-IN")} max`}
        />
        <StatTile
          label="KPIs on track"
          value={`${kpiPerf.length - underperformers.length}/${kpiPerf.length}`}
          sub={
            underperformers.length
              ? `${underperformers.length} need attention`
              : "All performing"
          }
          accent={underperformers.length ? "warn" : "good"}
        />
      </div>

      {/* Donut + legend */}
      <div className="rounded-md border border-border bg-card px-4 py-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          KPI-level attainment
        </div>
        {kpiPerf.length === 0 ? (
          <div className="text-xs text-muted-foreground py-3">
            No KPIs enabled for this programme.
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth={stroke}
                />
                {kpiPerf.map((k, idx) => {
                  const offset = -idx * segPct * circumference;
                  return (
                    <circle
                      key={k.key}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={k.color}
                      strokeWidth={stroke}
                      strokeDasharray={`${segLen} ${circumference - segLen}`}
                      strokeDashoffset={offset}
                      strokeLinecap="butt"
                      pointerEvents="stroke"
                      opacity={hoveredIdx !== null && hoveredIdx !== idx ? 0.3 : 1}
                      className="cursor-pointer transition-opacity"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {hoveredIdx === null ? (
                  <>
                    <span className="text-2xl font-bold text-foreground tabular-nums">{overall}%</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-foreground tabular-nums">
                      {kpiPerf[hoveredIdx].attainment}%
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center px-2 leading-tight">
                      {kpiPerf[hoveredIdx].label}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 w-full">
              {kpiPerf.map((k, idx) => {
                const flagged = k.attainment < 70;
                return (
                  <div
                    key={k.key}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className={cn(
                      "flex items-center gap-2 text-[11px] rounded px-1.5 py-1 cursor-default transition-colors",
                      hoveredIdx === idx && "bg-muted",
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: k.color }}
                    />
                    <span className="text-foreground truncate flex-1">{k.label}</span>
                    {flagged && (
                      <AlertTriangle size={10} className="text-amber-600 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        k.attainment >= 90
                          ? "text-emerald-700"
                          : k.attainment >= 70
                          ? "text-amber-700"
                          : "text-red-700",
                      )}
                    >
                      {k.attainment}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Actionable insights */}
      {kpiPerf.length > 0 && (
        <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary font-semibold">
            <Lightbulb size={12} /> What to do next
          </div>
          <ul className="space-y-1.5 text-[12px] text-foreground">
            {underperformers.slice(0, 2).map((k) => (
              <li key={k.key} className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-red-500 shrink-0" />
                <span>
                  <span className="font-semibold">{k.label} ({k.attainment}%):</span>{" "}
                  {suggestionFor(k.label, k.attainment)}
                </span>
              </li>
            ))}
            {underperformers.length === 0 && topPerformer && (
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  <span className="font-semibold">{topPerformer.label}</span> is leading at{" "}
                  {topPerformer.attainment}% — share the playbook with peers.
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="mt-1 w-1 h-1 rounded-full bg-primary shrink-0" />
              <span>
                Projected payout this cycle: <span className="font-semibold">₹{estPayout.toLocaleString("en-IN")}</span>{" "}
                ({overall}% of max). {overall < 70 ? "A 10-point lift on the bottom 2 KPIs adds ~₹" + Math.round(programme.maxMonthlyEarning * 0.05).toLocaleString("en-IN") + " in payout." : "Maintain pace to hit the upper slab."}
              </span>
            </li>
          </ul>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={onEdit}>
            <Pencil size={12} />
            Open editor
          </Button>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  accent = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "good" | "warn" | "bad" | "neutral";
}) {
  const accentClass =
    accent === "good"
      ? "text-emerald-700"
      : accent === "warn"
      ? "text-amber-700"
      : accent === "bad"
      ? "text-red-700"
      : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("text-base font-semibold tabular-nums inline-flex items-center gap-1.5 mt-0.5", accentClass)}>
        {icon}
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <AlertCircle size={26} />
      </div>
      <h2 className="text-base font-semibold text-foreground">No programmes yet</h2>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        Create your first incentive programme or start from one of the 13 Emami templates.
      </p>
      <div className="flex items-center gap-2 mt-5">
        <Button size="sm" className="gap-1.5 text-xs" onClick={onCreateNew}>
          <Plus size={14} /> Create from scratch
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <Lightbulb size={14} /> Browse templates
        </Button>
      </div>
    </div>
  );
}

// ─── Status filter pills ────────────────────────────────────────────────────
function StatusPillBar({
  value,
  onChange,
  programmes,
}: {
  value: "all" | "active" | "draft" | "archived";
  onChange: (v: "all" | "active" | "draft" | "archived") => void;
  programmes: Programme[];
}) {
  const counts = useMemo(() => {
    const c = { all: 0, active: 0, draft: 0, archived: 0 };
    programmes.forEach((p) => {
      c.all += 1;
      if (p.status === "active") c.active += 1;
      else if (p.status === "draft") c.draft += 1;
      else if (p.status === "archived" || p.status === "locked") c.archived += 1;
    });
    return c;
  }, [programmes]);

  const pills: Array<{ key: typeof value; label: string }> = [
    { key: "all", label: "All" },
    { key: "active", label: "Live" },
    { key: "draft", label: "Draft" },
    { key: "archived", label: "Ended" },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pills.map((p) => {
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-muted/60",
            )}
          >
            {p.label}
            <span
              className={cn(
                "tabular-nums text-[10px] px-1.5 py-0.5 rounded-full",
                active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {counts[p.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
