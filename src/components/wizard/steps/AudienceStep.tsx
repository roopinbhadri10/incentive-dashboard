import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CircleDot,
  Layers,
  MapPin,
  Stethoscope,
  Users,
} from "lucide-react";
import { mockProgrammes } from "@/data/mockData";
import type { Programme } from "@/types/programme";

// ─── Types ──────────────────────────────────────────────────────────────────
export type AudienceChannel = "CCD" | "HCD";
export type AudienceRole = "MR" | "ASO_ASE" | "ASO" | "ASM";
export type AudienceSegment =
  | "urban-retail"
  | "urban-wholesale"
  | "rural-ss"
  | "hybrid"
  | "urban"
  | "rural"
  | "urban-cities"
  | "other-markets";
export type AudienceGeography = "all-india" | "kerala";

export interface AudienceState {
  channel: AudienceChannel | null;
  role: AudienceRole | null;
  segment: AudienceSegment | null;
  geography: AudienceGeography;
  derivedProgrammeKey: string | null;
}

export const emptyAudience: AudienceState = {
  channel: null,
  role: null,
  segment: null,
  geography: "all-india",
  derivedProgrammeKey: null,
};

export function isAudienceComplete(a: AudienceState): boolean {
  if (!a.channel || !a.role) return false;
  // CCD ASO/ASE has no segment selector — treat as complete once role is set.
  if (a.channel === "CCD" && a.role === "ASO_ASE") return true;
  return a.segment !== null;
}

interface AudienceStepProps {
  value: AudienceState;
  onChange: (next: AudienceState) => void;
  onCloneInstead?: (programmeId: string) => void;
}

// ─── Static option data ─────────────────────────────────────────────────────
const CHANNELS: Array<{
  id: AudienceChannel;
  title: string;
  subtitle: string;
  icon: typeof Building2;
  accent: string;
  accentSoft: string;
}> = [
  {
    id: "CCD",
    title: "CCD — Consumer Care Division",
    subtitle: "General trade · 6 programme types",
    icon: Building2,
    accent: "#006D4E",
    accentSoft: "rgba(0,109,78,0.08)",
  },
  {
    id: "HCD",
    title: "HCD — Healthcare Division",
    subtitle: "Health & OTC · 7 programme types",
    icon: Stethoscope,
    accent: "#483D9E",
    accentSoft: "rgba(72,61,158,0.08)",
  },
];

const ROLES_BY_CHANNEL: Record<AudienceChannel, Array<{ id: AudienceRole; title: string; desc: string }>> = {
  CCD: [
    { id: "MR", title: "Market Reporter (MR)", desc: "Frontline rep — outlet billing & coverage" },
    { id: "ASO_ASE", title: "ASO / ASE", desc: "Area Sales Officer / Executive — territory ownership" },
  ],
  HCD: [
    { id: "MR", title: "Market Reporter (MR)", desc: "Frontline rep — chemist & doctor coverage" },
    { id: "ASO", title: "ASO", desc: "Area Sales Officer — channel focus & team metrics" },
    { id: "ASM", title: "ASM", desc: "Area Sales Manager — region oversight" },
  ],
};

interface SegmentOption {
  id: AudienceSegment;
  title: string;
  desc: string;
}

function getSegmentConfig(channel: AudienceChannel, role: AudienceRole): {
  label: string;
  note?: string;
  options: SegmentOption[];
} | null {
  if (channel === "CCD" && role === "MR") {
    return {
      label: "Working channel",
      note: "Select the channel this MR works in. This determines KPI structure.",
      options: [
        { id: "urban-retail", title: "Urban — Retail", desc: "Direct DB retail outlets" },
        { id: "urban-wholesale", title: "Urban — Wholesale", desc: "Direct DB wholesale outlets" },
        { id: "rural-ss", title: "Rural", desc: "Super Stockist network" },
      ],
    };
  }
  if (channel === "HCD" && role === "MR") {
    return {
      label: "Working channel",
      note: "Select the beat this MR services. Drives NSV basis & gates.",
      options: [
        { id: "urban", title: "Urban", desc: "Urban DB beat" },
        { id: "hybrid", title: "Hybrid", desc: "Mix of urban + rural" },
        { id: "rural", title: "Rural", desc: "Sub DB network" },
      ],
    };
  }
  if (channel === "HCD" && role === "ASO") {
    return {
      label: "Coverage geography",
      note: "Geography determines which Channel Focus KPIs apply.",
      options: [
        { id: "urban-cities", title: "Urban cities", desc: "Delhi, Mumbai, Kolkata" },
        { id: "other-markets", title: "Other markets", desc: "All remaining" },
      ],
    };
  }
  if (channel === "HCD" && role === "ASM") {
    return {
      label: "Coverage geography",
      note: "Geography determines Channel Focus payout schedule.",
      options: [
        { id: "urban-cities", title: "Urban cities", desc: "Delhi, Mumbai" },
        { id: "other-markets", title: "Other markets", desc: "All remaining" },
      ],
    };
  }
  return null; // CCD ASO/ASE — no segment
}

// ─── Programme matching ─────────────────────────────────────────────────────
function makeKey(a: AudienceState): string | null {
  if (!a.channel || !a.role) return null;
  const segPart = a.segment ?? "all";
  const geoPart = a.geography;
  return `${a.channel}-${a.role}-${segPart}-${geoPart}`.toLowerCase().replace(/_/g, "-");
}

function matchProgramme(a: AudienceState): Programme | null {
  if (!a.channel || !a.role) return null;
  // CCD ASO/ASE has no segment dimension in the data model.
  return (
    mockProgrammes.find((p) => {
      if (p.channel !== a.channel) return false;
      if (p.role !== a.role) return false;
      // Geography
      const wantsKerala = a.geography === "kerala";
      const isKeralaProg = p.geography === "kerala";
      if (wantsKerala !== isKeralaProg) return false;
      // Segment
      if (a.channel === "CCD" && a.role === "ASO_ASE") return true;
      if (!a.segment) return false;
      // For HCD ASO/ASM "urban-cities" / "other-markets" matches segment field.
      return p.segment === a.segment;
    }) ?? null
  );
}

function summarizeKpis(p: Programme): string[] {
  const map: Record<string, string> = {
    A_nsv: "NSV",
    B_phasing: "Phasing",
    C_eco: "ECO",
    D_tlsd: "TLSD",
    E_dbb: "DBB",
    F_cft: "CFT",
    G_subDbBilling: "Sub-DB Billing",
    H_msb: "MSB",
    I_channelFocus: "Channel Focus",
    J_teamEarning: "Team Earning",
    K_appUsage: "App Usage",
    L_quarterly: "Q1 Quarterly",
  };
  return Object.entries(p.kpis)
    .filter(([, cfg]) => cfg?.enabled)
    .map(([k]) => map[k] ?? k);
}

function segmentTitleFromState(a: AudienceState): string | null {
  if (!a.channel || !a.role) return null;
  const cfg = getSegmentConfig(a.channel, a.role);
  if (!cfg) return null;
  return cfg.options.find((o) => o.id === a.segment)?.title ?? null;
}

// ─── Component ──────────────────────────────────────────────────────────────
export function AudienceStep({ value, onChange, onCloneInstead }: AudienceStepProps) {
  const setChannel = (channel: AudienceChannel) => {
    if (value.channel === channel) return;
    onChange({
      ...emptyAudience,
      channel,
      // Kerala doesn't apply to HCD; force back to all-india.
      geography: channel === "HCD" ? "all-india" : value.geography,
    });
  };

  const setRole = (role: AudienceRole) => {
    if (value.role === role) return;
    onChange({
      ...value,
      role,
      segment: null,
      derivedProgrammeKey: null,
    });
  };

  const setSegment = (segment: AudienceSegment) => {
    const next = { ...value, segment };
    onChange({ ...next, derivedProgrammeKey: makeKey(next) });
  };

  const setGeography = (kerala: boolean) => {
    if (value.channel === "HCD" && kerala) return; // disabled for HCD
    const next: AudienceState = { ...value, geography: kerala ? "kerala" : "all-india" };
    onChange({ ...next, derivedProgrammeKey: makeKey(next) });
  };

  const segmentCfg = value.channel && value.role ? getSegmentConfig(value.channel, value.role) : null;
  const showSegmentBlock = !!segmentCfg;
  const segmentSelected =
    value.channel === "CCD" && value.role === "ASO_ASE" ? true : value.segment !== null;
  const showGeographyBlock = !!value.role && (segmentSelected || !showSegmentBlock);

  const matchedProgramme = useMemo(() => matchProgramme(value), [value]);
  const derivedKey = makeKey(value);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            What type of programme is this?
          </h2>
          <p className="text-xs text-muted-foreground">
            Choose the channel, role and working segment. This drives KPI structure, gates and slab rates — it has nothing to do with where reps are physically based (that's the next step).
          </p>
        </header>

        {/* ── LEVEL 1 — Channel ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <SectionLabel index={1} label="Division" complete={!!value.channel} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              const selected = value.channel === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  className={cn(
                    "group relative text-left rounded-xl border-2 p-4 transition-all",
                    "hover:shadow-md hover:-translate-y-0.5",
                    selected ? "shadow-md" : "border-border bg-card"
                  )}
                  style={
                    selected
                      ? { borderColor: c.accent, backgroundColor: c.accentSoft }
                      : undefined
                  }
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: c.accent }}
                    >
                      <Icon size={22} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{c.title}</p>
                        {selected && (
                          <Check
                            size={16}
                            className="shrink-0"
                            style={{ color: c.accent }}
                            aria-label="Selected"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.subtitle}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── LEVEL 2 — Role ─────────────────────────────────────────────── */}
        {value.channel && (
          <section className="space-y-2 animate-fade-in">
            <SectionLabel index={2} label="Role type" complete={!!value.role} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ROLES_BY_CHANNEL[value.channel].map((r) => {
                const selected = value.role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={cn(
                      "text-left rounded-lg border-2 p-3 transition-all hover:border-primary/50",
                      selected ? "border-primary bg-primary/5" : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Users size={16} className="text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-foreground">{r.title}</p>
                          {selected && <Check size={12} className="text-primary shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          {r.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── LEVEL 3 — Segment / Geography (working context) ───────────── */}
        {value.channel && value.role && (
          <section className="space-y-2 animate-fade-in">
            <SectionLabel
              index={3}
              label="Define the audience segment"
              complete={segmentSelected}
            />

            {showSegmentBlock && segmentCfg ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground/80">{segmentCfg.label}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {segmentCfg.options.map((s) => {
                    const selected = value.segment === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSegment(s.id)}
                        className={cn(
                          "text-left rounded-lg border-2 p-3 transition-all hover:border-primary/50",
                          selected ? "border-primary bg-primary/5" : "border-border bg-card"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Layers size={14} className="text-primary mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-foreground">{s.title}</p>
                              {selected && <Check size={12} className="text-primary shrink-0" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {segmentCfg.note && (
                  <p className="text-[11px] text-muted-foreground italic flex items-start gap-1">
                    <CircleDot size={10} className="mt-0.5 shrink-0 text-primary" />
                    {segmentCfg.note}
                  </p>
                )}
              </div>
            ) : (
              // CCD ASO/ASE — no segmentation, summary card instead
              <Card className="p-3 bg-muted/30 border-dashed">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-primary mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">No segmentation needed.</span>{" "}
                    ASO / ASE programmes apply uniformly across the territory — KPI structure is
                    determined by geography only.
                  </div>
                </div>
              </Card>
            )}
          </section>
        )}

        {/* ── KPI rule variant (subtle Kerala toggle) ───────────────────── */}
        {showGeographyBlock && (
          <section className="space-y-2 animate-fade-in">
            <Card
              className={cn(
                "p-3 transition-colors border-dashed",
                value.geography === "kerala" && "border-amber-300 bg-amber-50/40 border-solid"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Layers size={14} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      KPI rule variant
                    </p>
                    <p className="text-xs text-foreground mt-0.5">
                      Use Kerala KPI rules
                    </p>
                  </div>
                </div>
                {value.channel === "HCD" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Switch checked={false} disabled aria-label="Kerala KPI rules (disabled for HCD)" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs max-w-[220px]">
                      Kerala KPI rules don't apply to HCD programmes.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Switch
                    checked={value.geography === "kerala"}
                    onCheckedChange={setGeography}
                    aria-label="Use Kerala KPI rules"
                  />
                )}
              </div>

              {value.geography === "kerala" && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-100/60 p-2.5 flex items-start gap-2 animate-fade-in">
                  <AlertTriangle size={14} className="text-amber-700 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    This variant uses <span className="font-semibold">Primary NSV</span>, different
                    slab rates, and removes <span className="font-semibold">ECO / TLSD / DBB</span>.
                    Choose this only if the programme mechanics are Kerala-specific — not just
                    because the audience is based in Kerala.
                  </p>
                </div>
              )}
            </Card>
          </section>
        )}

        {/* ── Derived programme preview ─────────────────────────────────── */}
        {value.channel && value.role && (
          <section className="animate-fade-in">
            <DerivedPreview
              audience={value}
              derivedKey={derivedKey}
              matchedProgramme={matchedProgramme}
              onCloneInstead={onCloneInstead}
              segmentTitle={segmentTitleFromState(value)}
            />
          </section>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({
  index,
  label,
  complete,
}: {
  index: number;
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
          complete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {complete ? <Check size={11} /> : index}
      </span>
      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function DerivedPreview({
  audience,
  derivedKey,
  matchedProgramme,
  segmentTitle,
  onCloneInstead,
}: {
  audience: AudienceState;
  derivedKey: string | null;
  matchedProgramme: Programme | null;
  segmentTitle: string | null;
  onCloneInstead?: (id: string) => void;
}) {
  const parts = [
    audience.channel,
    audience.role?.replace("_", "/"),
    segmentTitle ?? (audience.channel === "CCD" && audience.role === "ASO_ASE" ? "All territory" : null),
    audience.geography === "kerala" ? "Kerala" : "All India",
  ].filter(Boolean) as string[];

  const kpis = matchedProgramme ? summarizeKpis(matchedProgramme) : [];

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Derived programme
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{parts.join(" · ")}</p>
          {derivedKey && (
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{derivedKey}</p>
          )}
        </div>
        {matchedProgramme && (
          <Badge
            variant="secondary"
            className="text-[10px] gap-1 bg-primary/10 text-primary border border-primary/20"
          >
            <Check size={10} /> Matches existing programme
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg bg-card border border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            KPIs included
          </p>
          {kpis.length ? (
            <div className="flex flex-wrap gap-1">
              {kpis.map((k) => (
                <Badge key={k} variant="outline" className="text-[10px] font-normal">
                  {k}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Complete the selections to preview KPIs.
            </p>
          )}
        </div>
        <div className="rounded-lg bg-card border border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Max potential earning
          </p>
          {matchedProgramme ? (
            <p className="text-lg font-bold text-foreground tabular-nums">
              ₹{matchedProgramme.maxMonthlyEarning.toLocaleString()}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">/ month</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">—</p>
          )}
        </div>
      </div>

      {matchedProgramme && onCloneInstead && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-primary/5 border border-primary/15 p-2.5">
          <p className="text-[11px] text-foreground/80">
            An identical programme already exists. Clone it instead of recreating from scratch?
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-[11px] h-7 gap-1 text-primary hover:text-primary"
            onClick={() => onCloneInstead(matchedProgramme.id)}
          >
            Clone instead <ArrowRight size={12} />
          </Button>
        </div>
      )}
    </Card>
  );
}
