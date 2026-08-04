import { useCallback, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { fetchRules } from "@/lib/ruleApi";
import { ruleToProgramme } from "@/lib/ruleToProgramme";
import { fetchProgramRoles, fetchRolePayloadValues, fetchRoleDesignations } from "@/lib/saleshubApi";
import { programmeCategory } from "@/pages/ProgramsPage";
import {
  analyseProgrammes,
  demoProgrammes,
  formatInr,
  formatRole,
  healthOf,
  CHANNEL_STYLE,
  type ProgrammeAnalytics,
} from "@/lib/programmeAnalytics";
import {
  buildAllReps,
  attainmentBands,
  payoutQuartiles,
  payForPerformanceRatio,
  periodElapsedPct,
  statsByState,
  type RepRecord,
} from "@/lib/repAnalytics";
import {
  fetchProgramAnalytics,
  byProgramId,
  weightedAttainment,
  type ProgramAnalytics,
} from "@/lib/analyticsApi";
import { IndiaMapView, metricValue, metricLabel, type MapMetric } from "@/components/analytics/IndiaMapView";
import { RepDrilldownSheet, type RepDrilldownData } from "@/components/analytics/RepDrilldownSheet";
import type { Channel, Programme, RoleType } from "@/types/programme";

type View = "overview" | "programmes" | "people" | "geography";

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "programmes", label: "Programmes" },
  { id: "people", label: "People" },
  { id: "geography", label: "Geography" },
];

/* ─────────────────────────── small primitives ─────────────────────────── */

function Metric({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.09em] text-muted-foreground font-medium">{label}</p>
      <p className="mt-1.5 text-[26px] leading-none font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

/** Compact vertical histogram — no full-width bars anywhere. */
function Histogram({
  bands,
}: { bands: Array<{ label: string; reps: number; pct: number; payout: number }> }) {
  const max = Math.max(...bands.map((b) => b.reps), 1);
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {bands.map((b, i) => {
        const h = Math.round((b.reps / max) * 92) + 4;
        const tone = i === 0 ? "hsl(var(--status-risk))" : i === 1 ? "hsl(var(--status-watch))" : "hsl(var(--primary))";
        return (
          <div key={b.label} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold tabular-nums text-foreground">{b.reps}</span>
            <div className="w-full h-[104px] flex items-end">
              <div
                className="w-full rounded-t-[3px] transition-all"
                style={{ height: h, background: tone, opacity: 0.85 }}
                title={`${b.reps} users · ${formatInr(b.payout)}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground text-center leading-tight">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Payout concentration donut across performance quartiles. */
function ConcentrationDonut({
  slices,
}: { slices: Array<{ label: string; sharePct: number; payout: number; reps: number }> }) {
  const size = 168, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const colors = ["hsl(var(--primary))", "#4FC3AE", "#9BD9CD", "#DCEDE9"];
  let offset = 0;
  const total = slices.reduce((s, q) => s + q.sharePct, 0) || 100;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        {slices.map((q, i) => {
          const frac = q.sharePct / total;
          const dash = frac * c;
          const el = (
            <circle
              key={q.label}
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={colors[i]} strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <ul className="space-y-2.5 min-w-0">
        {slices.map((q, i) => (
          <li key={q.label} className="flex items-center gap-2.5 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colors[i] }} />
            <span className="text-foreground w-[76px]">{q.label}</span>
            <span className="font-semibold tabular-nums w-9 text-right">{q.sharePct}%</span>
            <span className="text-muted-foreground tabular-nums">{formatInr(q.payout)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tiny attainment ring used in programme rows. */
function MiniRing({ value }: { value: number }) {
  const size = 40, stroke = 4, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.min(100, value);
  const h = healthOf(value);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={h.hsl} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[10px] font-semibold">
        {value}
      </text>
    </svg>
  );
}

/* ─────────────────────────────── the page ─────────────────────────────── */

export function AnalyticsPage() {
  const [view, setView] = useState<View>("overview");
  const [channelFilter, setChannelFilter] = useState<"all" | Channel>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | RoleType>("all");
  const [period, setPeriod] = useState("current");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [repQuery, setRepQuery] = useState("");
  const [repSort, setRepSort] = useState<"attainment" | "earnings">("attainment");
  const [drillRep, setDrillRep] = useState<RepDrilldownData | null>(null);
  const [mapMetric, setMapMetric] = useState<MapMetric>("attainment");
  const [selectedState, setSelectedState] = useState<string | null>(null);

  // Same query key as the Programmes list, so Analytics always reports on the
  // exact programmes the user sees under Programmes / Create / Clone. Falls back
  // to demo programmes only when the engine has none.
  const { data: liveProgrammes } = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      const [rules] = await Promise.all([
        fetchRules(),
        fetchProgramRoles().catch(() => []),
        fetchRolePayloadValues().catch(() => ({})),
        fetchRoleDesignations().catch(() => ({})),
      ]);
      return rules.map(ruleToProgramme);
    },
  });

  const programmes: Programme[] =
    liveProgrammes && liveProgrammes.length > 0 ? liveProgrammes : demoProgrammes;

  // Real programme analytics from the engine, joined on programId.
  const { data: apiAnalytics = [], isLoading: analyticsLoading } = useQuery({
    queryKey: ["programAnalytics"],
    queryFn: fetchProgramAnalytics,
  });
  const apiByProgram = useMemo(() => byProgramId(apiAnalytics), [apiAnalytics]);

  /**
   * Overlay engine figures onto each programme. The analytics endpoint carries
   * the numbers but not the audience (channel / role / geography), so those
   * still come from the rule; everything quantitative below is the engine's.
   * A programme with no analytics record keeps its zeros and reads as awaiting
   * data rather than being estimated locally.
   */
  const withApi = useCallback(
    (list: ReturnType<typeof analyseProgrammes>) =>
      list.map((p) => {
        const api = p.programme.programId ? apiByProgram.get(p.programme.programId) : undefined;
        if (!api) {
          // No engine record — report zeros, never the synthetic estimates the
          // old model produced (which also went NaN for API-sourced programmes,
          // whose per-KPI weights are empty).
          return {
            ...p,
            api: undefined as ProgramAnalytics | undefined,
            overall: 0,
            totalUsers: 0,
            engagedUsers: 0,
            engagedPct: 0,
            totalBudget: 0,
            budgetUsed: 0,
            budgetUsedPct: 0,
            estPayout: 0,
            kpis: [],
          };
        }
        return {
          ...p,
          api,
          overall: Math.round(api.overallAttainmentPct),
          totalUsers: api.totalUsers,
          engagedUsers: api.engagedUsers,
          engagedPct: Math.round(api.engagedPct),
          totalBudget: api.totalBudget,
          budgetUsed: api.budgetUsed,
          budgetUsedPct: Math.round(api.budgetUsedPct),
          maxPayoutPerUser: api.maxMonthlyEarning,
          estPayout: api.estimatedPayout,
          gateCount: api.gatesCount,
          kpis: api.kpiPerformanceList.map((k) => ({
            key: k.kpiKey,
            label: k.kpiName,
            attainment: Math.round(k.attainmentPct),
            weight: 0,
          })),
        };
      }),
    [apiByProgram],
  );

  const allAnalytics = useMemo(() => withApi(analyseProgrammes(programmes)), [programmes, withApi]);
  /**
   * Programmes analytics reports on: anything that has started and isn't
   * archived. Uses the SAME date-based categorisation as the programmes list, so
   * a rule the engine still marks DRAFT but which is inside its effective window
   * appears in both places — filtering on the stored status here would have hidden
   * exactly those rows from analytics while the list showed them as Active.
   */
  const live = useMemo(
    () =>
      withApi(
        analyseProgrammes(
          programmes.filter((p) => {
            const c = programmeCategory(p);
            return c === "active" || c === "completed";
          }),
        ),
      ),
    [programmes, withApi],
  );

  const channels = useMemo(
    () => [...new Set(allAnalytics.map((p) => p.channel))] as Channel[],
    [allAnalytics],
  );
  const roles = useMemo(
    () => [...new Set(allAnalytics.map((p) => p.role))] as RoleType[],
    [allAnalytics],
  );

  const filtered = useMemo(
    () =>
      live.filter(
        (p) =>
          (channelFilter === "all" || p.channel === channelFilter) &&
          (roleFilter === "all" || p.role === roleFilter),
      ),
    [live, channelFilter, roleFilter],
  );

  const allReps = useMemo(() => buildAllReps(live), [live]);
  const ids = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);
  const reps = useMemo(() => allReps.filter((r) => ids.has(r.programmeId)), [allReps, ids]);

  const totals = useMemo(() => {
    // One programme can span several rules (one per KPI), all sharing a
    // programId — so aggregate over DISTINCT analytics records. Summing per row
    // would multiply a programme's users/payout by its rule count.
    const distinct = [
      ...new Map(
        filtered.filter((p) => p.api).map((p) => [p.api!.programId, p.api!]),
      ).values(),
    ];
    const users = distinct.reduce((s, a) => s + a.totalUsers, 0);
    const payout = distinct.reduce((s, a) => s + a.budgetUsed, 0);
    const overall = users
      ? Math.round(filtered.reduce((s, p) => s + p.overall * p.totalUsers, 0) / users)
      : 0;
    // Engine-reported engaged users, not a count of synthetic reps.
    const earning = distinct.reduce((s, a) => s + a.engagedUsers, 0);
    const kpisOnTrack = distinct.reduce((s, a) => s + a.kpisOnTrackCount, 0);
    const kpisTotal = distinct.reduce((s, a) => s + a.kpisTotalCount, 0);
    const kpisNeedAttention = distinct.reduce((s, a) => s + a.kpisNeedAttentionCount, 0);
    return {
      users, payout, earning, kpisOnTrack, kpisTotal, kpisNeedAttention,
      programmeCount: distinct.length,
      overall: weightedAttainment(distinct),
      earningPct: users ? Math.round((earning / users) * 100) : 0,
    };
  }, [filtered]);

  const bands = useMemo(() => attainmentBands(reps), [reps]);
  const quartiles = useMemo(() => payoutQuartiles(reps), [reps]);
  const elapsed = periodElapsedPct();
  const health = healthOf(totals.overall);

  /**
   * One row per PROGRAMME, not per rule. A programme with N KPIs is N rules that
   * share a programId, so without this the leaderboard repeats the same
   * programme N times with identical figures. Rules with no programId can't be
   * grouped, so they stand alone keyed by their own id.
   */
  const ranked = useMemo(() => {
    const byKey = new Map<string, (typeof filtered)[number]>();
    for (const row of filtered) {
      const key = row.api?.programId ?? row.id;
      const existing = byKey.get(key);
      // Prefer the row that actually carries analytics.
      if (!existing || (!existing.api && row.api)) byKey.set(key, row);
    }
    return [...byKey.values()].sort((a, b) => b.overall - a.overall);
  }, [filtered]);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  const geoStats = useMemo(() => statsByState(reps), [reps]);
  const rankedStates = useMemo(
    () => [...geoStats].sort((a, b) => metricValue(b, mapMetric) - metricValue(a, mapMetric)),
    [geoStats, mapMetric],
  );
  const selState = useMemo(
    () => geoStats.find((s) => s.state === selectedState) ?? null,
    [geoStats, selectedState],
  );

  const rankedReps = useMemo(() => {
    const q = repQuery.trim().toLowerCase();
    return [...reps]
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.region.toLowerCase().includes(q) || r.programmeName.toLowerCase().includes(q))
      .sort((a, b) => (repSort === "attainment" ? b.attainment - a.attainment : b.earnings - a.earnings));
  }, [reps, repSort, repQuery]);

  const openRep = (r: RepRecord) =>
    setDrillRep({
      name: r.name,
      program: r.programmeName,
      region: r.region,
      attainment: r.attainment,
      earnings: r.earnings,
      outlets: 60 + (r.attainment % 90),
    });

  const formatMapValue = (v: number) =>
    mapMetric === "payout" ? formatInr(v) : mapMetric === "users" ? `${v}` : `${v}%`;

  return (
    <div className="flex-1 overflow-y-auto" data-tour="analytics-page">
      <div className="max-w-[1180px] mx-auto px-6 py-6 space-y-5">
        {/* ── Controls ───────────────────────────────────────────────── */}
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <nav className="flex items-center gap-6 border-b border-border -mb-px">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "pb-2.5 text-[13px] transition-colors border-b-2 -mb-px",
                  view === v.id
                    ? "text-primary font-semibold border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground",
                )}
              >
                {v.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current period</SelectItem>
                <SelectItem value="mtd">Month to date</SelectItem>
                <SelectItem value="qtd">Quarter to date</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as "all" | Channel)}>
              <SelectTrigger className="w-[132px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {channels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | RoleType)}>
              <SelectTrigger className="w-[124px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => <SelectItem key={r} value={r}>{formatRole(r)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* ── Always-on topline ──────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
          <Metric
            label="Attainment"
            value={`${totals.overall}%`}
            sub={`${health.label} · ${elapsed}% of period elapsed`}
            tone={health.hsl}
          />
          <Metric
            label="Payout to date"
            value={formatInr(totals.payout)}
            sub={`${totals.programmeCount || filtered.length} live programmes`}
          />
          <Metric
            label="Users earning"
            value={`${totals.earning}`}
            sub={`${totals.earningPct}% of ${totals.users.toLocaleString("en-IN")} enrolled`}
          />
          <Metric
            label="KPIs on track"
            value={totals.kpisTotal ? `${totals.kpisOnTrack}/${totals.kpisTotal}` : "—"}
            sub={
              totals.kpisTotal
                ? `${totals.kpisNeedAttention} need attention`
                : "Awaiting data"
            }
          />
        </div>

        {/* ── Overview ───────────────────────────────────────────────── */}
        {view === "overview" && (
          <div className="space-y-5">
            {best && worst && best.id !== worst.id && (
              <p className="text-[12px] leading-relaxed text-muted-foreground px-1">
                <span className="uppercase text-foreground font-medium">{best.name}</span> leads at{" "}
                <span className="text-foreground font-semibold">{best.overall}%</span>, while{" "}
                <span className="uppercase text-foreground font-medium">{worst.name}</span> trails at{" "}
                <span className="text-foreground font-semibold">{worst.overall}%</span>.
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <SectionTitle title="Where people land" hint="Users grouped by attainment against target" />
                <Histogram bands={bands} />
              </Card>
              <Card className="p-5">
                <SectionTitle title="Who the money reaches" hint="Payout share by performance quartile" />
                <ConcentrationDonut slices={quartiles} />
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h3 className="text-[13px] font-semibold text-foreground">Programme leaderboard</h3>
              </div>
              <div className="divide-y divide-border">
                {ranked.slice(0, 6).map((p) => (
                  <ProgrammeLine key={p.id} p={p} />
                ))}
              </div>
              {ranked.length > 6 && (
                <button
                  onClick={() => setView("programmes")}
                  className="w-full px-5 py-2.5 text-[11px] text-primary hover:bg-muted/30 transition-colors border-t border-border"
                >
                  View all {ranked.length} programmes
                </button>
              )}
            </Card>
          </div>
        )}

        {/* ── Programmes ─────────────────────────────────────────────── */}
        {view === "programmes" && (
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-border">
              {ranked.map((p) => (
                <div key={p.id}>
                  <ProgrammeLine
                    p={p}
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    active={expanded === p.id}
                  />
                  {expanded === p.id && (
                    <div className="px-5 pb-5 pt-1 bg-muted/20">
                      <SectionTitle title="KPI attainment" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {p.kpis.map((k) => {
                          const kh = healthOf(k.attainment);
                          return (
                            <div key={k.key} className="rounded-md border border-border bg-card px-3 py-2.5">
                              <p className="text-[11px] text-muted-foreground truncate">{k.label}</p>
                              <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-[15px] font-semibold tabular-nums" style={{ color: kh.hsl }}>
                                  {k.attainment}%
                                </span>
                                <span className="text-[10px] text-muted-foreground">{kh.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!ranked.length && (
                <p className="px-5 py-8 text-xs text-muted-foreground">No programmes match the current filters.</p>
              )}
            </div>
          </Card>
        )}

        {/* ── People ─────────────────────────────────────────────────── */}
        {view === "people" && (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={repQuery}
                  onChange={(e) => setRepQuery(e.target.value)}
                  placeholder="Search person, region or programme"
                  className="h-9 w-[280px] pl-8 text-sm"
                />
              </div>
              <Select value={repSort} onValueChange={(v) => setRepSort(v as "attainment" | "earnings")}>
                <SelectTrigger className="w-[168px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="attainment">Sort by attainment</SelectItem>
                  <SelectItem value="earnings">Sort by earnings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
              {rankedReps.slice(0, 60).map((r) => {
                const h = healthOf(r.attainment);
                return (
                  <button
                    key={r.id}
                    onClick={() => openRep(r)}
                    className="w-full px-5 py-2.5 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: h.hsl }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-foreground truncate">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {r.roleLabel} · {r.state} · <span className="uppercase">{r.programmeName}</span>
                      </p>
                    </div>
                    {r.gateFailed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 shrink-0">Gated</span>
                    )}
                    <span className="text-[12px] font-semibold tabular-nums w-12 text-right">{r.attainment}%</span>
                    <span className="text-[12px] tabular-nums w-16 text-right text-muted-foreground">
                      {formatInr(r.earnings)}
                    </span>
                  </button>
                );
              })}
              {!rankedReps.length && (
                <p className="px-5 py-8 text-xs text-muted-foreground">No one matches that search.</p>
              )}
            </div>
          </Card>
        )}

        {/* ── Geography ──────────────────────────────────────────────── */}
        {view === "geography" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            <Card className="p-4 lg:col-span-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <SectionTitle title={metricLabel(mapMetric)} hint="Click a state to drill in" />
                <Select value={mapMetric} onValueChange={(v) => setMapMetric(v as MapMetric)}>
                  <SelectTrigger className="w-[168px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attainment">Attainment</SelectItem>
                    <SelectItem value="payout">Payout</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="coverage">Coverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <IndiaMapView
                stats={geoStats}
                metric={mapMetric}
                selected={selectedState}
                onSelect={setSelectedState}
                formatValue={formatMapValue}
              />
            </Card>

            <Card className="p-0 lg:col-span-2 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h3 className="text-[13px] font-semibold text-foreground">
                  {selState ? selState.state : "State ranking"}
                </h3>
                {selState && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selState.users} users · {selState.attainment}% attainment · {formatInr(selState.payout)}
                  </p>
                )}
              </div>
              {selState ? (
                <div className="divide-y divide-border">
                  {selState.programmes.map((pr) => (
                    <div key={pr.id} className="px-5 py-2.5 flex items-center gap-3">
                      <span className="text-[12px] text-foreground truncate flex-1 uppercase">{pr.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{pr.users}u</span>
                      <span className="text-[12px] font-semibold tabular-nums w-11 text-right">{pr.attainment}%</span>
                    </div>
                  ))}
                  <button
                    onClick={() => setSelectedState(null)}
                    className="w-full px-5 py-2.5 text-[11px] text-primary hover:bg-muted/30 transition-colors"
                  >
                    Back to ranking
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                  {rankedStates.map((s, i) => (
                    <button
                      key={s.state}
                      onClick={() => setSelectedState(s.state)}
                      className="w-full px-5 py-2.5 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-[11px] text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                      <span className="text-[12px] text-foreground truncate flex-1">{s.state}</span>
                      <span className="text-[12px] font-semibold tabular-nums">
                        {formatMapValue(metricValue(s, mapMetric))}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <RepDrilldownSheet open={!!drillRep} onOpenChange={(o) => !o && setDrillRep(null)} rep={drillRep} />
    </div>
  );
}

/* ─────────────────────────── programme row ─────────────────────────── */

function ProgrammeLine({
  p, onClick, active,
}: { p: ProgrammeAnalytics; onClick?: () => void; active?: boolean }) {
  const ch = CHANNEL_STYLE[p.channel];
  const body = (
    <>
      <MiniRing value={p.overall} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-foreground truncate uppercase tracking-tight">{p.name}</p>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
            style={{ background: ch.bg, color: ch.fg }}
          >
            {ch.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {[p.roleLabel, p.segmentLabel, p.geographyLabel, p.periodLabel].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="hidden sm:block text-right w-16">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Users</p>
        <p className="text-[12px] font-semibold tabular-nums">{p.totalUsers}</p>
      </div>
      <div className="text-right w-20">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Payout</p>
        <p className="text-[12px] font-semibold tabular-nums">{formatInr(p.budgetUsed)}</p>
      </div>
    </>
  );

  if (!onClick) {
    return <div className="px-5 py-3 flex items-center gap-4">{body}</div>;
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-5 py-3 flex items-center gap-4 text-left transition-colors hover:bg-muted/30",
        active && "bg-muted/30",
      )}
    >
      {body}
    </button>
  );
}
