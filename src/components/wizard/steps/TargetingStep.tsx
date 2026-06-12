import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Globe2,
  MapPin,
  Plus,
  Sliders,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { AudienceState } from "./AudienceStep";

// ─── Catalog ────────────────────────────────────────────────────────────────
export const ZONE_TAGS = ["North", "South", "East", "West", "Central"] as const;
export const STATE_TAGS = [
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "Kerala",
  "Gujarat",
  "Rajasthan",
  "UP",
  "MP",
] as const;
export const CITY_TAGS = [
  "Delhi",
  "Mumbai",
  "Kolkata",
  "Bangalore",
  "Hyderabad",
  "Chennai",
] as const;

export type GeoTagKind = "all-india" | "zone" | "state" | "city";
export interface GeoTag {
  kind: GeoTagKind;
  value: string; // "All India" for all-india kind
}

const ALL_INDIA: GeoTag = { kind: "all-india", value: "All India" };

export type Tenure = "any" | "<3m" | "3-12m" | ">1y";
export type PerfBand = "any" | "top30" | "below" | "custom";
export type HeadcountSource = "auto" | "upload";

export interface TargetingState {
  scope: GeoTag[];
  tenure: Tenure;
  perfBand: PerfBand;
  customPerfPct?: number;
  dbCluster: string;
  source: HeadcountSource;
}

export const emptyTargeting: TargetingState = {
  scope: [],
  tenure: "any",
  perfBand: "any",
  dbCluster: "",
  source: "auto",
};

export function isTargetingComplete(t: TargetingState): boolean {
  return t.scope.length > 0;
}

/** Human-readable summary for the Next-button label. */
export function targetingNextLabel(t: TargetingState): string {
  if (t.scope.length === 0) return "Configure KPIs →";
  const all = t.scope.find((s) => s.kind === "all-india");
  if (all) return "Configure KPIs for All India →";
  const names = t.scope.map((s) => s.value);
  const joined = names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
  return `Configure KPIs for ${joined} →`;
}

// ─── Reach estimator ────────────────────────────────────────────────────────
const ROLE_BASE: Record<string, number> = {
  MR: 120,
  ASO_ASE: 24,
  ASO: 20,
  ASM: 8,
};
const SEGMENT_FACTOR: Record<string, number> = {
  "urban-retail": 1.0,
  "urban-wholesale": 0.55,
  "rural-ss": 0.8,
  urban: 0.9,
  hybrid: 0.7,
  rural: 0.55,
  "urban-cities": 0.4,
  "other-markets": 1.1,
  all: 1.0,
};

function estimateReach(audience: AudienceState | null, t: TargetingState): number {
  if (!audience?.channel || !audience.role) return 0;
  if (t.scope.length === 0) return 0;
  const base = ROLE_BASE[audience.role] ?? 50;
  const segFactor = audience.segment ? SEGMENT_FACTOR[audience.segment] ?? 1 : 1;
  let geoMult = 0;
  for (const tag of t.scope) {
    switch (tag.kind) {
      case "all-india": geoMult = Math.max(geoMult, 1); break;
      case "zone": geoMult += 0.22; break;
      case "state": geoMult += 0.07; break;
      case "city": geoMult += 0.025; break;
    }
  }
  // Filter dampening
  let filterMult = 1;
  if (t.tenure !== "any") filterMult *= 0.55;
  if (t.perfBand === "top30") filterMult *= 0.3;
  else if (t.perfBand === "below") filterMult *= 0.4;
  else if (t.perfBand === "custom") filterMult *= 0.5;
  if (t.dbCluster.trim()) filterMult *= 0.7;
  const raw = base * segFactor * geoMult * filterMult;
  return Math.max(0, Math.round(raw / 5) * 5);
}

// ─── Component ──────────────────────────────────────────────────────────────
interface Props {
  value: TargetingState;
  onChange: (next: TargetingState) => void;
  audience: AudienceState | null;
}

export function TargetingStep({ value, onChange, audience }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(
    value.tenure !== "any" ||
      value.perfBand !== "any" ||
      !!value.dbCluster ||
      value.source === "upload",
  );

  const reach = useMemo(() => estimateReach(audience, value), [audience, value]);
  const audienceMissing = !audience?.channel || !audience.role;

  const addTag = (tag: GeoTag) => {
    if (tag.kind === "all-india") {
      onChange({ ...value, scope: [ALL_INDIA] });
      return;
    }
    // Adding a specific tag clears All India.
    const without = value.scope.filter((s) => s.kind !== "all-india");
    if (without.some((s) => s.kind === tag.kind && s.value === tag.value)) return;
    onChange({ ...value, scope: [...without, tag] });
  };

  const removeTag = (tag: GeoTag) => {
    onChange({
      ...value,
      scope: value.scope.filter((s) => !(s.kind === tag.kind && s.value === tag.value)),
    });
  };

  const hasAllIndia = value.scope.some((s) => s.kind === "all-india");

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Who is this programme for?
        </h2>
        <p className="text-xs text-muted-foreground">
          Define the audience. This is independent of KPI rules — selecting Kerala here only
          means the audience is Kerala-based.
        </p>
      </header>

      {/* ─── SECTION A — Geography targeting ───────────────────────────── */}
      <section className="space-y-2">
        <SectionHeader index="A" title="Where are these reps based?" icon={<Globe2 size={14} />} />

        <Card className="p-3 space-y-3">
          {/* Selected tags */}
          <div className="min-h-[36px] flex items-center flex-wrap gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
            {value.scope.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">
                Select one or more locations…
              </span>
            ) : (
              value.scope.map((tag) => (
                <TagChip key={`${tag.kind}:${tag.value}`} tag={tag} onRemove={() => removeTag(tag)} />
              ))
            )}
            <GeoPicker
              hasAllIndia={hasAllIndia}
              selected={value.scope}
              onAdd={addTag}
            />
          </div>

          {/* Quick chips */}
          <div className="space-y-2">
            <QuickRow
              label="All India"
              items={[ALL_INDIA]}
              selected={value.scope}
              onAdd={addTag}
              variant="primary"
            />
            <QuickRow
              label="Zones"
              items={ZONE_TAGS.map((v) => ({ kind: "zone" as const, value: v }))}
              selected={value.scope}
              onAdd={addTag}
              disabled={hasAllIndia}
            />
            <QuickRow
              label="Cities"
              items={CITY_TAGS.map((v) => ({ kind: "city" as const, value: v }))}
              selected={value.scope}
              onAdd={addTag}
              disabled={hasAllIndia}
            />
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/60 pt-2">
            <span className="font-medium text-foreground">Note:</span> Kerala KPI rules are set in
            Step 1. Selecting Kerala here just means the audience is Kerala-based. If your
            programme also uses Kerala's different KPI structure, make sure
            <span className="font-medium text-foreground"> "Use Kerala KPI rules"</span> is toggled
            on in Step 1.
          </p>
        </Card>
      </section>

      {/* ─── SECTION B — Rep filters ───────────────────────────────────── */}
      <section>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between p-3 rounded-md border border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Add filters</span>
                <span className="text-[11px] text-muted-foreground">
                  Narrow down by tenure, performance, DB or upload a list
                </span>
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  "text-muted-foreground transition-transform",
                  filtersOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Tenure */}
              <FilterField label="Tenure">
                <Select
                  value={value.tenure}
                  onValueChange={(v) => onChange({ ...value, tenure: v as Tenure })}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any tenure</SelectItem>
                    <SelectItem value="<3m">{"< 3 months"}</SelectItem>
                    <SelectItem value="3-12m">3–12 months</SelectItem>
                    <SelectItem value=">1y">{"> 1 year"}</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              {/* Performance band */}
              <FilterField label="Performance band">
                <Select
                  value={value.perfBand}
                  onValueChange={(v) => onChange({ ...value, perfBand: v as PerfBand })}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="top30">Top 30% last quarter</SelectItem>
                    <SelectItem value="below">Below target last month</SelectItem>
                    <SelectItem value="custom">Custom %</SelectItem>
                  </SelectContent>
                </Select>
                {value.perfBand === "custom" && (
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="e.g. 80"
                    value={value.customPerfPct ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        customPerfPct: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="mt-1.5 h-8 text-xs"
                  />
                )}
              </FilterField>

              {/* DB / Cluster */}
              <FilterField label="DB / Cluster">
                <Input
                  placeholder="e.g. DB-North-12, Mumbai-Cluster-A"
                  value={value.dbCluster}
                  onChange={(e) => onChange({ ...value, dbCluster: e.target.value })}
                  className="h-9 text-xs"
                />
              </FilterField>

              {/* Headcount source */}
              <FilterField label="Headcount source">
                <div className="flex gap-2">
                  <SourceTile
                    icon={<Users size={14} />}
                    label="Auto"
                    desc="All matching reps"
                    selected={value.source === "auto"}
                    onClick={() => onChange({ ...value, source: "auto" })}
                  />
                  <SourceTile
                    icon={<Upload size={14} />}
                    label="Upload list"
                    desc="CSV"
                    selected={value.source === "upload"}
                    onClick={() => onChange({ ...value, source: "upload" })}
                  />
                </div>
              </FilterField>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </section>

      {/* ─── SECTION C — Reach estimate ────────────────────────────────── */}
      <section>
        <Card className="p-4 bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Users size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Estimated reach
              </p>
              {audienceMissing ? (
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  Complete Step 1 first to estimate reach.
                </p>
              ) : value.scope.length === 0 ? (
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  Select at least one location to estimate reach.
                </p>
              ) : (
                <p className="text-sm text-foreground mt-0.5">
                  Based on your selections: approximately{" "}
                  <span className="text-lg font-bold text-primary tabular-nums">
                    {reach.toLocaleString()}
                  </span>{" "}
                  reps will receive this programme.
                </p>
              )}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function SectionHeader({
  index,
  title,
  icon,
}: {
  index: string;
  title: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
        {index}
      </span>
      <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
        {icon}
        {title}
      </p>
    </div>
  );
}

function TagChip({ tag, onRemove }: { tag: GeoTag; onRemove: () => void }) {
  const variant = tag.kind === "all-india" ? "primary" : tag.kind;
  const styles = {
    primary: "bg-primary/10 text-primary border-primary/20",
    zone: "bg-blue-50 text-blue-700 border-blue-200",
    state: "bg-purple-50 text-purple-700 border-purple-200",
    city: "bg-amber-50 text-amber-800 border-amber-200",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border",
        styles[variant as keyof typeof styles],
      )}
    >
      {tag.kind !== "all-india" && (
        <MapPin size={10} className="opacity-70" />
      )}
      {tag.value}
      <button
        type="button"
        onClick={onRemove}
        className="opacity-60 hover:opacity-100 transition-opacity"
        aria-label={`Remove ${tag.value}`}
      >
        <X size={10} />
      </button>
    </span>
  );
}

function GeoPicker({
  hasAllIndia,
  selected,
  onAdd,
}: {
  hasAllIndia: boolean;
  selected: GeoTag[];
  onAdd: (tag: GeoTag) => void;
}) {
  const [open, setOpen] = useState(false);
  const isSelected = (kind: GeoTagKind, value: string) =>
    selected.some((s) => s.kind === kind && s.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          <Plus size={10} /> Add
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search zones, states, cities..." className="text-xs" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Scope">
              <CommandItem
                onSelect={() => {
                  onAdd(ALL_INDIA);
                  setOpen(false);
                }}
                className="text-xs"
                disabled={hasAllIndia}
              >
                <Globe2 size={12} className="mr-2" /> All India
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Zones">
              {ZONE_TAGS.map((z) => (
                <CommandItem
                  key={z}
                  disabled={hasAllIndia || isSelected("zone", z)}
                  onSelect={() => { onAdd({ kind: "zone", value: z }); setOpen(false); }}
                  className="text-xs"
                >
                  {z}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="States">
              {STATE_TAGS.map((s) => (
                <CommandItem
                  key={s}
                  disabled={hasAllIndia || isSelected("state", s)}
                  onSelect={() => { onAdd({ kind: "state", value: s }); setOpen(false); }}
                  className="text-xs"
                >
                  {s}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Cities">
              {CITY_TAGS.map((c) => (
                <CommandItem
                  key={c}
                  disabled={hasAllIndia || isSelected("city", c)}
                  onSelect={() => { onAdd({ kind: "city", value: c }); setOpen(false); }}
                  className="text-xs"
                >
                  {c}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function QuickRow({
  label,
  items,
  selected,
  onAdd,
  disabled,
  variant,
}: {
  label: string;
  items: GeoTag[];
  selected: GeoTag[];
  onAdd: (tag: GeoTag) => void;
  disabled?: boolean;
  variant?: "primary";
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      {items.map((tag) => {
        const isSel = selected.some((s) => s.kind === tag.kind && s.value === tag.value);
        return (
          <button
            key={`${tag.kind}:${tag.value}`}
            type="button"
            disabled={disabled || isSel}
            onClick={() => onAdd(tag)}
            className={cn(
              "px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors",
              isSel
                ? "bg-primary/10 text-primary border-primary/20 cursor-default"
                : variant === "primary"
                ? "border-primary/30 text-primary hover:bg-primary/5"
                : "border-border text-foreground/70 hover:border-primary/40 hover:text-primary",
              disabled && !isSel && "opacity-40 cursor-not-allowed hover:border-border hover:text-foreground/70",
            )}
          >
            {tag.value}
          </button>
        );
      })}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SourceTile({
  icon,
  label,
  desc,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 text-left rounded-md border-2 p-2 transition-all",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
      )}
    >
      <div className="flex items-center gap-1.5 text-foreground">
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}
