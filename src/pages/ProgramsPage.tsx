import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
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
  Eye,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  Lock,
  BarChart3,
  PlayCircle,
  X,
} from "lucide-react";
import { stepName as wizardStepName, TOTAL_WIZARD_STEPS } from "@/lib/wizardDraftStore";
import { friendlyMessage } from "@/lib/apiError";
import {
  fetchProgramAnalytics,
  byProgramId,
  type ProgramAnalytics,
} from "@/lib/analyticsApi";
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
  /** Part-built programmes autosaved by the wizard. */
  drafts?: Array<{ id: string; name: string; atStep: number; updatedAt: string }>;
  onResumeDraft?: (id: string) => void;
  onDiscardDraft?: (id: string) => void;
  /** Controlled status filter. Supplied by the /campaigns/:status routes so the
   *  sidebar, the URL and the dropdown can't drift apart. Omitted on /programs,
   *  where the dropdown owns the filter locally. */
  statusFilter?: StatusFilter;
  onStatusFilterChange?: (v: StatusFilter) => void;
}

function formatRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
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

// The standard campaign/filter vocabulary: Active · Scheduled · Draft ·
// Completed · Archived.
//
// NOTE the value/label mismatch on the last one: the engine flags an archived
// programme with `isActive: false`, which ruleToProgramme maps to the status
// `"inactive"` — so the filter value stays `"inactive"` while the label reads
// "Archived". Renaming the value to `"archived"` would silently retarget the
// filter at the *other* status, `ProgrammeStatus["archived"]`, which this app
// surfaces as "Completed".
export type StatusFilter = "all" | "active" | "scheduled" | "draft" | "completed" | "inactive";

/** Category a published programme falls into. "draft" is not reachable here — a
 *  draft has no engine record; those live in the wizard draft store. */
export type ProgrammeCategory = "active" | "scheduled" | "completed" | "inactive";

/** Local midnight for an ISO `YYYY-MM-DD`, so comparisons are whole-day. */
function startOfDay(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(t) ? null : t;
}

/**
 * Categorise a programme from the engine's effective window:
 *   Archived  — turned off (`isActive: false`), regardless of dates
 *   Scheduled — today is before effectiveFrom
 *   Completed — today is after effectiveTill
 *   Active    — today falls inside the window (inclusive)
 *
 * Falls back to the stored status when the window is missing/unparseable, so a
 * rule without dates still lands somewhere sensible instead of vanishing.
 */
export function programmeCategory(p: Programme, now: Date = new Date()): ProgrammeCategory {
  // A switched-off programme is archived whatever its dates say.
  if (p.status === "inactive") return "inactive";

  const today = startOfDay(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  )!;
  const from = startOfDay(p.effectiveFrom);
  const till = startOfDay(p.effectiveTill);

  if (from !== null && today < from) return "scheduled";
  if (till !== null && today > till) return "completed";
  if (from !== null || till !== null) return "active";

  // No usable window — fall back to the stored status.
  if (p.status === "archived" || p.status === "locked") return "completed";
  return p.status === "active" ? "active" : "completed";
}

const CATEGORY_LABEL: Record<ProgrammeCategory, string> = {
  active: "Active",
  scheduled: "Scheduled",
  completed: "Completed",
  inactive: "Archived",
};

// Pill + dot are keyed off the same derived category as the label, so colour and
// wording can never disagree.
const CATEGORY_PILL: Record<ProgrammeCategory, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  // Completed and Archived are both "no longer running", so both read muted.
  // Completed sits slightly lighter so the two stay distinguishable side by side.
  completed: "bg-muted/50 text-muted-foreground/70 border-border",
  inactive: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_DOT: Record<ProgrammeCategory, string> = {
  active: "bg-emerald-500",
  scheduled: "bg-sky-500",
  completed: "bg-muted-foreground/40",
  inactive: "bg-muted-foreground/60",
};

// Proper-cased, standardised label for a programme. Never renders the raw data
// value to the user.
function statusLabel(p: Programme): string {
  return CATEGORY_LABEL[programmeCategory(p)];
}

const CHANNEL_STYLE: Record<ChannelType, { bg: string; fg: string; label: string }> = {
  CCD: { bg: "rgba(0,109,78,0.10)",  fg: "#006D4E", label: "CCD" },
  HCD: { bg: "rgba(72,61,158,0.10)", fg: "#483D9E", label: "HCD" },
};

// ─── Quick-stats helpers ────────────────────────────────────────────────────
function formatInr(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount >= 100000000 ? 0 : 1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount >= 1000000 ? 0 : 1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Headline payout / attainment for a programme row, straight from
 * GET /v1/programs/analytics. `undefined` means the engine has no analytics for
 * this programme — either it predates `programId` or no cycle has run — and the
 * row reads "Awaiting data". Nothing here is derived or estimated locally.
 */
type ProgrammeQuickStats = ProgramAnalytics | undefined;

// ─── Main page ──────────────────────────────────────────────────────────────
export function ProgramsPage({
  onCreateNew,
  onOpenProgram,
  onCloneProgram,
  onCloneMultiple,
  onViewAnalytics,
  onOpenSavedProgram,
  savedPrograms = [],
  drafts = [],
  onResumeDraft,
  onDiscardDraft,
  statusFilter: statusFilterProp,
  onStatusFilterChange,
}: ProgramsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | ChannelType>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | string>("all");
  // Controlled by the route on /campaigns/:status, local otherwise.
  const [internalStatusFilter, setInternalStatusFilter] = useState<StatusFilter>("all");
  const statusFilter = statusFilterProp ?? internalStatusFilter;
  const setStatusFilter = (v: StatusFilter) => {
    if (onStatusFilterChange) onStatusFilterChange(v);
    else setInternalStatusFilter(v);
  };
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
    refetch,
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
  // Live analytics for every programme in the tenant, joined onto rows by
  // programId. Kept in its own query so a slow/failing analytics call never
  // blocks the programmes list from rendering.
  const { data: analyticsList = [] } = useQuery({
    queryKey: ["programAnalytics"],
    queryFn: fetchProgramAnalytics,
  });
  const analyticsByProgram = useMemo(() => byProgramId(analyticsList), [analyticsList]);

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
      console.error("[archive] failed:", err);
      toast({
        title: "Couldn't archive programme",
        description: friendlyMessage(err, "archive this programme"),
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
        // "Draft" means unpublished wizard drafts, which have no engine record —
        // so no published programme belongs under it.
        if (statusFilter === "draft") return false;
        if (programmeCategory(p) !== statusFilter) return false;
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
      <div className="flex-1 overflow-y-auto">
        <div className="surface-panel mx-6 mb-6 p-5 space-y-4">
          {/* Header — slim count row with an inline filter reset */}
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-hairline">
            <h1 className="text-lg font-semibold text-foreground">Programmes</h1>
            <p className="text-xs text-muted-foreground">
              <span className="text-primary font-semibold">{filtered.length}</span>
              <span> of {programmes.length} programmes</span>
              {(channelFilter !== "all" || roleFilter !== "all" || statusFilter !== "all" || periodFilter !== "all") && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => {
                      setChannelFilter("all");
                      setRoleFilter("all");
                      setStatusFilter("all");
                      setPeriodFilter("all");
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Drafts in progress — resume the wizard from the step you left */}
          {drafts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Drafts in progress ({drafts.length})
                </div>
                <span className="text-[10px] text-muted-foreground/70">
                  Auto-saved — pick up right where you left off
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {drafts.map((d) => {
                  const pct = Math.round((d.atStep / TOTAL_WIZARD_STEPS) * 100);
                  const timeAgo = formatRelativeTime(new Date(d.updatedAt));
                  return (
                    <div
                      key={d.id}
                      className="group relative p-3 rounded-md border border-dashed border-orange-300/70 bg-orange-50/40 hover:border-orange-400 hover:bg-orange-50 transition"
                    >
                      <button
                        type="button"
                        onClick={() => onResumeDraft?.(d.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Pencil size={11} className="text-orange-600 shrink-0" />
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-orange-700">
                            Draft
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {timeAgo}
                          </span>
                        </div>
                        <div className="text-sm font-medium truncate text-foreground">{d.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Step {d.atStep} of {TOTAL_WIZARD_STEPS} · {wizardStepName(d.atStep)}
                        </div>
                        <div className="mt-2 h-1 w-full rounded-full bg-orange-100 overflow-hidden">
                          <div className="h-full bg-orange-400" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-orange-700">
                          <PlayCircle size={12} /> Continue
                        </div>
                      </button>
                      {onDiscardDraft && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDiscardDraft(d.id);
                          }}
                          aria-label="Discard draft"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center text-muted-foreground hover:text-destructive"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="h-px bg-border my-2" />
            </div>
          )}

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
            <div className="py-12 text-center space-y-3">
              <p className="text-sm font-medium text-foreground">Couldn't load programmes</p>
              <p className="text-xs text-muted-foreground">
                {friendlyMessage(error, "load programmes")}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : isEmpty ? (
            <EmptyState onCreateNew={onCreateNew} />
          ) : (
            <>
              {/* Filter / sort bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={channelFilter}
                  onValueChange={(v) => setChannelFilter(v as typeof channelFilter)}
                >
                  <SelectTrigger className={cn("w-[130px] h-9 text-xs bg-card relative", channelFilter !== "all" && "border-primary ring-1 ring-primary after:content-[''] after:absolute after:top-1 after:right-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary")}>
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
                  <SelectTrigger className={cn("w-[130px] h-9 text-xs bg-card relative", roleFilter !== "all" && "border-primary ring-1 ring-primary after:content-[''] after:absolute after:top-1 after:right-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary")}>
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
                  <SelectTrigger className={cn("w-[130px] h-9 text-xs bg-card relative", statusFilter !== "all" && "border-primary ring-1 ring-primary after:content-[''] after:absolute after:top-1 after:right-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary")}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="inactive">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className={cn("w-[140px] h-9 text-xs bg-card gap-1.5 relative", periodFilter !== "all" && "border-primary ring-1 ring-primary after:content-[''] after:absolute after:top-1 after:right-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary")}>
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
                    analytics={p.programId ? analyticsByProgram.get(p.programId) : undefined}
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
  analytics,
}: {
  programme: Programme;
  /** This programme's record from GET /v1/programs/analytics, if any. */
  analytics?: ProgramAnalytics;
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
  // A live programme is inside its effective window — scheduled ones haven't
  // started, so they get neither the glow nor the pulsing dot, and no stats.
  const category = programmeCategory(programme);
  const isLive = category === "active";
  // Scheduled programmes haven't started, so even a returned record has nothing
  // meaningful to show yet.
  const stats = category === "scheduled" ? undefined : analytics;

  return (
    <Card
      className={cn(
        "group relative border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(0,163,146,0.55)] hover:border-primary/40 overflow-hidden",
        selected && "border-primary/50 bg-primary/[0.03]",
        expanded && "border-primary/40 shadow-sm",
        isLive && "card-active-glow",
      )}
    >
      <div className="p-4 flex items-stretch gap-4">
        {/* Checkbox — appears on hover or when selected */}
        <div
          className={cn(
            "shrink-0 self-center transition-opacity",
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
          className="flex-1 min-w-0 text-left flex flex-col justify-center gap-1.5"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[15px] font-medium tracking-tight text-foreground truncate uppercase">
              {programme.name}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
                    CATEGORY_PILL[category],
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      CATEGORY_DOT[category],
                      isLive && "pulse-dot",
                    )}
                  />
                  {statusLabel(programme)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {statusLabel(programme)}
                {pendingMdm && " · MDM upload pending"}
              </TooltipContent>
            </Tooltip>
          </div>

          <p className="text-[13px] text-muted-foreground truncate">
            {[programme.role ? formatRole(programme.role) : "", segmentLabel].filter(Boolean).join(" · ") || "—"}
          </p>

          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/90">
            <CalendarDays size={12} />
            <span>{formatPeriod(programme.period)}</span>
            {programme.geography === "kerala" && (
              <span className="ml-2 inline-flex items-center px-1.5 h-[18px] rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Kerala
              </span>
            )}
          </div>
        </button>

        {/* Right: channel pill + stat blocks + actions */}
        <div className="flex items-stretch gap-4 shrink-0">
          {/* Channel pill */}
          <div className="hidden md:flex items-start pt-1">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold"
              style={{ backgroundColor: channel.bg, color: channel.fg }}
            >
              {channel.label}
            </span>
          </div>

          {/* Vertical separator */}
          <div className="hidden md:block w-px bg-border/70 self-stretch" />

          <ProgrammeInlineStats stats={stats} />

          {/* Eye — view details */}
          <div className="flex items-center gap-0.5 self-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={onToggleExpand}
                  aria-label={expanded ? "Collapse details" : "View details"}
                >
                  <Eye size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {expanded ? "Hide details" : "View details"}
              </TooltipContent>
            </Tooltip>

          {/* 3-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreHorizontal size={15} />
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
          </div>

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

// Headline payout + attainment blocks shown on the right of each programme row.
// Every figure comes from GET /v1/programs/analytics; with no record for this
// programme both blocks read "Awaiting data" rather than showing a guess.
function ProgrammeInlineStats({ stats }: { stats: ProgrammeQuickStats }) {
  const hasData = !!stats;
  const attainment = stats?.overallAttainmentPct ?? 0;
  const delta = stats?.attainmentDelta ?? 0;

  const attainmentTone = !hasData
    ? "bg-muted/60 text-muted-foreground"
    : attainment >= 100
    ? "bg-emerald-50 text-emerald-900"
    : attainment >= 80
    ? "bg-amber-50 text-amber-900"
    : "bg-rose-50 text-rose-900";

  const items = [
    {
      label: "Total Payout",
      value: hasData ? formatInr(Math.round(stats!.budgetUsed)) : "—",
      sub: hasData
        ? stats!.totalBudget > 0
          ? `${Math.round(stats!.budgetUsedPct)}% of ${formatInr(Math.round(stats!.totalBudget))} budget`
          : `Max ${formatInr(Math.round(stats!.maxMonthlyEarning))} / rep`
        : "Awaiting data",
      subTone: "text-teal-700/80",
      tone: hasData ? "bg-teal-50 text-teal-900" : "bg-muted/60 text-muted-foreground",
      tooltip: hasData
        ? "Payout accrued so far this period, against the programme's total budget."
        : "The incentive engine has no analytics for this programme yet.",
    },
    {
      label: "Attainment",
      value: hasData ? `${Math.round(attainment)}%` : "—",
      sub: hasData
        ? `${delta >= 0 ? "+" : ""}${Math.round(delta)}% vs target`
        : "Awaiting data",
      subTone: hasData
        ? delta >= 0 ? "text-emerald-700/80" : "text-rose-700/80"
        : "text-muted-foreground",
      tone: attainmentTone,
      tooltip: hasData
        ? `Overall KPI attainment. ${stats!.engagedUsers} of ${stats!.totalUsers} users engaged.`
        : "The incentive engine has no analytics for this programme yet.",
    },
  ];

  return (
    <div className="hidden lg:flex items-center gap-5 self-center">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-1 min-w-[150px]">
          <p className="text-[11px] text-muted-foreground">{it.label}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("flex items-baseline gap-2 px-3 py-1.5 rounded-md cursor-default", it.tone)}>
                <span className="text-[17px] font-bold tabular-nums leading-none">{it.value}</span>
                <span className={cn("text-[10px] font-medium", it.subTone)}>{it.sub}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[220px]">
              {it.tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
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
          This programme is {statusLabel(programme)} — editing is locked. You can view, clone, or act on the insights below.
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

