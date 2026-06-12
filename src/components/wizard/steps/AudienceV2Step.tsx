import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Info, X, Database, ChevronRight, Check } from "lucide-react";
import { useState } from "react";
import type { AudienceV2State, Channel } from "../builderState";
import { PROGRAM_ROLES } from "../builderState";

interface Props {
  value: AudienceV2State;
  onChange: (v: AudienceV2State) => void;
}

// Mock master-data: in real integration this comes from client MDM.
// Hierarchy: Zone → State → City
const GEOGRAPHY_TREE: Record<string, Record<string, string[]>> = {
  North: {
    Delhi: ["New Delhi"],
    "Uttar Pradesh": ["Lucknow", "Noida", "Kanpur"],
    Punjab: ["Ludhiana", "Amritsar"],
    Rajasthan: ["Jaipur", "Udaipur"],
  },
  South: {
    Karnataka: ["Bengaluru", "Mysuru"],
    "Tamil Nadu": ["Chennai", "Coimbatore"],
    Kerala: ["Kochi", "Thiruvananthapuram", "Kozhikode"],
    Telangana: ["Hyderabad"],
  },
  East: {
    "West Bengal": ["Kolkata", "Howrah"],
    Odisha: ["Bhubaneswar"],
  },
  West: {
    Maharashtra: ["Mumbai", "Pune", "Nagpur"],
    Gujarat: ["Ahmedabad", "Surat"],
  },
  Central: {
    "Madhya Pradesh": ["Bhopal", "Indore"],
  },
};




function CascadingGeoPicker({
  placeholder,
  selected,
  onToggle,
  includeAllIndia = true,
  scopeGeographies,
}: {
  placeholder: string;
  selected: string[];
  onToggle: (tag: string) => void;
  includeAllIndia?: boolean;
  /** When set, the tree is limited to descendants of these selected regions —
   *  used by the Exceptions picker so you can only exclude within what you selected. */
  scopeGeographies?: string[];
}) {
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [activeState, setActiveState] = useState<string | null>(null);

  // Exceptions are scoped to descendants of the selected regions. "All India"
  // (or no selection) imposes no restriction.
  const restricted =
    scopeGeographies !== undefined &&
    scopeGeographies.length > 0 &&
    !scopeGeographies.includes("All India");
  const openZones = new Set<string>();
  const openStates = new Set<string>();
  const openCities = new Set<string>();
  if (restricted) {
    for (const tag of scopeGeographies!) {
      if (tag.startsWith("Zone: ")) openZones.add(tag.slice(6));
      else if (tag.startsWith("State: ")) openStates.add(tag.slice(7));
      else if (tag.startsWith("City: ")) openCities.add(tag.slice(6));
    }
  }

  // A selected node is a "boundary" only when nothing deeper within it is also
  // selected. Exceptions are a boundary's *strict descendants*, so the most
  // specific selection wins — pick a city and there's nothing left to exclude.
  const statesOf = (z: string) => Object.keys(GEOGRAPHY_TREE[z]);
  const citiesOf = (z: string, s: string) => GEOGRAPHY_TREE[z][s];
  const stateHasOpenCity = (z: string, s: string) => citiesOf(z, s).some((c) => openCities.has(c));
  const zoneHasOpenState = (z: string) => statesOf(z).some((s) => openStates.has(s));
  const zoneHasOpenCity = (z: string) => statesOf(z).some((s) => stateHasOpenCity(z, s));
  const zoneIsBoundary = (z: string) =>
    openZones.has(z) && !zoneHasOpenState(z) && !zoneHasOpenCity(z);
  const stateIsBoundary = (z: string, s: string) => openStates.has(s) && !stateHasOpenCity(z, s);

  const allZones = Object.keys(GEOGRAPHY_TREE);
  const zones = restricted
    ? allZones.filter((z) => openZones.has(z) || zoneHasOpenState(z) || zoneHasOpenCity(z))
    : allZones;

  const states = !activeZone
    ? []
    : !restricted || zoneIsBoundary(activeZone)
    ? statesOf(activeZone)
    : statesOf(activeZone).filter((s) => openStates.has(s) || stateHasOpenCity(activeZone, s));

  const cities =
    !activeZone || !activeState
      ? []
      : !restricted || zoneIsBoundary(activeZone) || stateIsBoundary(activeZone, activeState)
      ? citiesOf(activeZone, activeState)
      : []; // selection narrows to a specific city → nothing left to exclude

  // Boundaries are drill-only; you can only exclude things strictly within them.
  const zoneSelectable = !restricted;
  const stateSelectable = !restricted || (!!activeZone && zoneIsBoundary(activeZone));

  const Row = ({
    label,
    tag,
    hasChildren,
    isActive,
    onSelect,
    selectable = true,
  }: {
    label: string;
    tag: string;
    hasChildren?: boolean;
    isActive?: boolean;
    onSelect?: () => void;
    selectable?: boolean;
  }) => {
    const checked = selected.includes(tag);
    return (
      <div
        className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer ${
          isActive ? "bg-muted" : "hover:bg-muted/60"
        }`}
        onClick={onSelect}
      >
        {selectable ? (
          <Checkbox
            checked={checked}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(tag);
            }}
            className="pointer-events-auto"
          />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="flex-1 truncate">{label}</span>
        {hasChildren && <ChevronRight size={12} className="opacity-40" />}
      </div>
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal h-auto min-h-10 py-2"
        >
          <div className="flex flex-wrap gap-1 items-center text-left">
            {selected.length === 0 ? (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            ) : (
              selected.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs gap-1">
                  {s}
                  <X
                    size={11}
                    className="cursor-pointer hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onToggle(s);
                    }}
                  />
                </Badge>
              ))
            )}
          </div>
          <ChevronDown size={14} className="opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[640px] p-0" align="start">
        <div className="grid grid-cols-3 divide-x divide-border max-h-80">
          {/* Zones column */}
          <div className="overflow-y-auto p-1">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Zone
            </div>
            {includeAllIndia && (
              <Row label="All India" tag="All India" />
            )}
            {zones.length === 0 ? (
              <div className="text-[11px] text-muted-foreground p-3">
                Select a region first to add exceptions within it.
              </div>
            ) : (
              zones.map((z) => (
                <Row
                  key={z}
                  label={z}
                  tag={`Zone: ${z}`}
                  hasChildren
                  isActive={activeZone === z}
                  selectable={zoneSelectable}
                  onSelect={() => {
                    setActiveZone(z);
                    setActiveState(null);
                  }}
                />
              ))
            )}
          </div>

          {/* States column */}
          <div className="overflow-y-auto p-1">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              State
            </div>
            {!activeZone ? (
              <div className="text-[11px] text-muted-foreground p-3">
                Select a zone to view its states.
              </div>
            ) : (
              states.map((s) => (
                <Row
                  key={s}
                  label={s}
                  tag={`State: ${s}`}
                  hasChildren
                  isActive={activeState === s}
                  selectable={stateSelectable}
                  onSelect={() => setActiveState(s)}
                />
              ))
            )}
          </div>

          {/* Cities column */}
          <div className="overflow-y-auto p-1">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              City
            </div>
            {!activeState ? (
              <div className="text-[11px] text-muted-foreground p-3">
                {activeZone ? "Select a state to view its cities." : "—"}
              </div>
            ) : cities.length === 0 ? (
              <div className="text-[11px] text-muted-foreground p-3">
                Nothing to exclude within this selection.
              </div>
            ) : (
              cities.map((c) => (
                <Row key={c} label={c} tag={`City: ${c}`} />
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AudienceV2Step({ value, onChange }: Props) {
  const setDivision = (c: Channel) => onChange({ ...value, division: c });

  const setRole = (r: string) => onChange({ ...value, roles: r ? [r] : [] });

  const toggleGeo = (g: string) => {
    if (g === "All India") {
      const already = value.geographies.includes("All India") && value.geographies.length === 1;
      return onChange({
        ...value,
        geographies: already ? [] : ["All India"],
        geographyExceptions: already ? value.geographyExceptions : value.geographyExceptions,
      });
    }
    const cleaned = value.geographies.filter((x) => x !== "All India");
    const next = cleaned.includes(g) ? cleaned.filter((x) => x !== g) : [...cleaned, g];
    onChange({ ...value, geographies: next });
  };

  const toggleException = (g: string) => {
    const next = value.geographyExceptions.includes(g)
      ? value.geographyExceptions.filter((x) => x !== g)
      : [...value.geographyExceptions, g];
    onChange({ ...value, geographyExceptions: next });
  };

  const selectedRole = value.roles[0] ?? "";

  const geoSummary =
    value.geographies.length === 0
      ? "(no region selected)"
      : value.geographies.join(", ") +
        (value.geographyExceptions.length
          ? ` — except ${value.geographyExceptions.join(", ")}`
          : "");

  const summary = [
    value.division || "(no division)",
    selectedRole || "(no role)",
    geoSummary,
  ].join(" · ");

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Audience definition</h2>
        <p className="text-sm text-muted-foreground">Who will participate in this programme?</p>
      </div>

      {/* Division */}
      <Card className="p-5 space-y-3">
        <Label className="text-sm font-medium">Select Division</Label>
        <div className="flex flex-wrap gap-2">
          {(["CCD", "HCD"] as Channel[]).map((c) => {
            const active = value.division === c;
            return (
              <button
                key={c}
                onClick={() => setDivision(c)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/40"
                }`}
              >
                {active && <Check size={12} strokeWidth={3} />}
                {c}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info size={11} className="mt-0.5 shrink-0" />
          The first level of division for incentive audiences.
        </p>
      </Card>

      {/* Role */}
      <Card className="p-5 space-y-3">
        <Label className="text-sm font-medium">Role</Label>
        <Select value={selectedRole} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue placeholder="Select a role from master data" />
          </SelectTrigger>
          <SelectContent>
            {PROGRAM_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Database size={11} className="mt-0.5 shrink-0" />
          Roles synced from client master data. Create one programme per role.
        </p>
      </Card>

      {/* Geography */}

      <Card className="p-5 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Region</Label>
          <CascadingGeoPicker
            placeholder="Select regions (Zone → State → City)"
            selected={value.geographies}
            onToggle={toggleGeo}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Exceptions <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <CascadingGeoPicker
            placeholder="e.g. North except Uttar Pradesh"
            selected={value.geographyExceptions}
            onToggle={toggleException}
            includeAllIndia={false}
            scopeGeographies={value.geographies}
          />
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info size={11} className="mt-0.5 shrink-0" />
            Pick wider regions above, then exclude specific zones/states/cities here.
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Database size={11} className="mt-0.5 shrink-0" />
          Regions integrated from client master data (zones, states, cities).
        </p>
      </Card>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          This programme will apply to:
        </div>
        <div className="text-sm font-medium">{summary}</div>
      </Card>
    </div>
  );
}


export function isAudienceV2Complete(a: AudienceV2State) {
  return !!a.division && a.roles.length > 0 && a.geographies.length > 0;
}
