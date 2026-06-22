import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Info, X, Database, ChevronRight, Check, Loader2, Users, FileSpreadsheet } from "lucide-react";
import { useState, useEffect } from "react";
import type { AudienceV2State, Channel } from "../builderState";
import {
  fetchProgramRoles,
  fetchRolePayloadValues,
  fetchRoleDesignations,
  fetchGeographyTree,
  type GeographyTree,
} from "@/lib/saleshubApi";
// NOTE: user lists are read from the local store for now. Once the backend
// exposes a "user lists by role" endpoint, swap batchesForRole/listBatches for
// that fetch — the selection shape (batch ids in userListBatchIds) stays the same.
import { batchesForRole, listBatches, type UserListBatch } from "@/lib/userListsStore";

interface Props {
  value: AudienceV2State;
  onChange: (v: AudienceV2State) => void;
}

/**
 * Drop exception tags that no longer fit the current region selection.
 * Mirrors the Exceptions picker's selectability: once a base region is chosen,
 * an exception must be a strict descendant of a "boundary" selection. An empty
 * selection or "All India" imposes no restriction, so exceptions are kept.
 */
function prunedExceptions(
  tree: GeographyTree,
  geographies: string[],
  exceptions: string[]
): string[] {
  const restricted = geographies.length > 0 && !geographies.includes("All India");
  // No scope, or master data not loaded yet → leave exceptions untouched.
  if (!restricted || Object.keys(tree).length === 0) return exceptions;

  const openZones = new Set<string>();
  const openStates = new Set<string>();
  const openCities = new Set<string>();
  for (const tag of geographies) {
    if (tag.startsWith("Zone: ")) openZones.add(tag.slice(6));
    else if (tag.startsWith("State: ")) openStates.add(tag.slice(7));
    else if (tag.startsWith("City: ")) openCities.add(tag.slice(6));
  }

  const statesOf = (z: string) => Object.keys(tree[z] ?? {});
  const citiesOf = (z: string, s: string) => tree[z]?.[s] ?? [];
  const stateHasOpenCity = (z: string, s: string) => citiesOf(z, s).some((c) => openCities.has(c));
  const zoneHasOpenState = (z: string) => statesOf(z).some((s) => openStates.has(s));
  const zoneHasOpenCity = (z: string) => statesOf(z).some((s) => stateHasOpenCity(z, s));
  const zoneIsBoundary = (z: string) =>
    openZones.has(z) && !zoneHasOpenState(z) && !zoneHasOpenCity(z);
  const stateIsBoundary = (z: string, s: string) => openStates.has(s) && !stateHasOpenCity(z, s);

  const zones = Object.keys(tree);
  const isValid = (tag: string): boolean => {
    if (tag.startsWith("State: ")) {
      const s = tag.slice(7);
      return zones.some((z) => statesOf(z).includes(s) && zoneIsBoundary(z));
    }
    if (tag.startsWith("City: ")) {
      const c = tag.slice(6);
      return zones.some((z) =>
        statesOf(z).some(
          (s) => citiesOf(z, s).includes(c) && (zoneIsBoundary(z) || stateIsBoundary(z, s))
        )
      );
    }
    // Zone-level exceptions aren't selectable once a base region is chosen.
    return false;
  };
  return exceptions.filter(isValid);
}

function CascadingGeoPicker({
  placeholder,
  selected,
  onToggle,
  includeAllIndia = true,
  scopeGeographies,
  tree,
  loading,
  error,
}: {
  placeholder: string;
  selected: string[];
  onToggle: (tag: string) => void;
  includeAllIndia?: boolean;
  /** When set, the tree is limited to descendants of these selected regions —
   *  used by the Exceptions picker so you can only exclude within what you selected. */
  scopeGeographies?: string[];
  /** Zone → State → City master data, fetched from SalesHub. */
  tree: GeographyTree;
  loading?: boolean;
  error?: string | null;
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
  const statesOf = (z: string) => Object.keys(tree[z] ?? {});
  const citiesOf = (z: string, s: string) => tree[z]?.[s] ?? [];
  const stateHasOpenCity = (z: string, s: string) => citiesOf(z, s).some((c) => openCities.has(c));
  const zoneHasOpenState = (z: string) => statesOf(z).some((s) => openStates.has(s));
  const zoneHasOpenCity = (z: string) => statesOf(z).some((s) => stateHasOpenCity(z, s));
  const zoneIsBoundary = (z: string) =>
    openZones.has(z) && !zoneHasOpenState(z) && !zoneHasOpenCity(z);
  const stateIsBoundary = (z: string, s: string) => openStates.has(s) && !stateHasOpenCity(z, s);

  const allZones = Object.keys(tree);
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
                  {/* Wrapper <span> (not an <svg>) so the Button's
                      [&_svg]:pointer-events-none rule can't disable the click.
                      Radix's trigger toggles on click, so stopPropagation here
                      keeps removal from also toggling the popover. */}
                  <span
                    role="button"
                    aria-label={`Remove ${s}`}
                    className="inline-flex items-center cursor-pointer rounded-sm hover:text-destructive"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onToggle(s);
                    }}
                  >
                    <X size={11} />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown size={14} className="opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[640px] p-0" align="start">
        <div className="grid grid-cols-3 divide-x divide-border h-80 overflow-hidden">
          {/* Zones column */}
          <div className="overflow-y-auto min-h-0 p-1">
            <div className="sticky top-0 z-10 bg-popover px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Zone
            </div>
            {includeAllIndia && (
              <Row label="All India" tag="All India" />
            )}
            {loading ? (
              <div className="text-[11px] text-muted-foreground p-3 flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Loading regions…
              </div>
            ) : error ? (
              <div className="text-[11px] text-destructive p-3">{error}</div>
            ) : zones.length === 0 ? (
              <div className="text-[11px] text-muted-foreground p-3">
                {restricted
                  ? "Select a region first to add exceptions within it."
                  : "No regions available."}
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
          <div className="overflow-y-auto min-h-0 p-1">
            <div className="sticky top-0 z-10 bg-popover px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
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
          <div className="overflow-y-auto min-h-0 p-1">
            <div className="sticky top-0 z-10 bg-popover px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
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
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const [geoTree, setGeoTree] = useState<GeographyTree>({});
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  // User lists are kept in a local store today; re-read whenever they change so
  // a list uploaded in another tab/page shows up here without a refresh.
  const [userLists, setUserLists] = useState<UserListBatch[]>(() => listBatches());
  useEffect(() => {
    const h = () => setUserLists(listBatches());
    window.addEventListener("userLists:change", h);
    return () => window.removeEventListener("userLists:change", h);
  }, []);

  useEffect(() => {
    fetchProgramRoles()
      .then(setRoles)
      .catch((e: Error) => setRolesError(e.message))
      .finally(() => setRolesLoading(false));
    // Warm the role → API value mapping so payload building can resolve it.
    fetchRolePayloadValues().catch(() => { /* non-fatal */ });
    // Warm the role → designation mapping for user_filters.
    fetchRoleDesignations().catch(() => { /* non-fatal */ });
  }, []);

  useEffect(() => {
    fetchGeographyTree()
      .then(setGeoTree)
      .catch((e: Error) => setGeoError(e.message))
      .finally(() => setGeoLoading(false));
  }, []);

  const setDivision = (c: Channel) => onChange({ ...value, division: c });

  const setRole = (r: string) => {
    // A user list belongs to exactly one role, so changing the role drops any
    // previously-selected lists that no longer match.
    const validIds = new Set(batchesForRole(r).map((b) => b.id));
    const keptLists = (value.userListBatchIds ?? []).filter((id) => validIds.has(id));
    onChange({ ...value, roles: r ? [r] : [], userListBatchIds: keptLists });
  };

  const toggleUserList = (id: string) => {
    const current = value.userListBatchIds ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    onChange({ ...value, userListBatchIds: next });
  };

  const toggleGeo = (g: string) => {
    let next: string[];
    if (g === "All India") {
      const already = value.geographies.includes("All India") && value.geographies.length === 1;
      next = already ? [] : ["All India"];
    } else {
      const cleaned = value.geographies.filter((x) => x !== "All India");
      next = cleaned.includes(g) ? cleaned.filter((x) => x !== g) : [...cleaned, g];
    }
    // Re-validate exceptions against the new selection so orphaned ones (e.g. a
    // state excluded under a region that's no longer selected) are dropped.
    onChange({
      ...value,
      geographies: next,
      geographyExceptions: prunedExceptions(geoTree, next, value.geographyExceptions),
    });
  };

  const toggleException = (g: string) => {
    const next = value.geographyExceptions.includes(g)
      ? value.geographyExceptions.filter((x) => x !== g)
      : [...value.geographyExceptions, g];
    onChange({ ...value, geographyExceptions: next });
  };

  const selectedRole = value.roles[0] ?? "";
  // Re-derived from `userLists` so it stays in sync with uploads from elsewhere.
  const roleUserLists = selectedRole
    ? userLists.filter((b) => b.role === selectedRole)
    : [];
  const selectedListIds = value.userListBatchIds ?? [];

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
        <Label className="text-sm font-medium">Division</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { id: "CCD", name: "Consumer Care Division" },
            { id: "HCD", name: "Healthcare Division" },
          ] as { id: Channel; name: string }[]).map((d) => {
            const active = value.division === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setDivision(d.id)}
                className={`relative text-left rounded-xl border p-4 transition-all ${
                  active
                    ? "border-primary ring-1 ring-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/30"
                }`}
              >
                {active && (
                  <span className="absolute top-3 right-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <div className="text-lg font-bold text-foreground">{d.id}</div>
                <div className="text-sm text-muted-foreground mt-1">{d.name}</div>
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
        <Select value={selectedRole} onValueChange={setRole} disabled={rolesLoading}>
          <SelectTrigger>
            {rolesLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 size={13} className="animate-spin" /> Loading roles…
              </span>
            ) : (
              <SelectValue placeholder="Select a role" />
            )}
          </SelectTrigger>
          <SelectContent>
            {rolesError ? (
              <div className="px-2 py-2 text-xs text-destructive">{rolesError}</div>
            ) : (
              roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Database size={11} className="mt-0.5 shrink-0" />
          Roles synced from config. Create one programme per role.
        </p>

        {/* User lists — the lists uploaded for the selected role on the Users
            List page. Selecting them scopes the programme to those users. */}
        {selectedRole && (
          <div className="space-y-2 border-t border-border pt-4">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Users size={14} /> User lists{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            {roleUserLists.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No user lists uploaded for {selectedRole}. Upload them on the Users
                List page to scope this programme to specific users.
              </p>
            ) : (
              <div className="space-y-2">
                {roleUserLists.map((b) => {
                  const checked = selectedListIds.includes(b.id);
                  const active = b.users.filter((u) => u.active).length;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleUserList(b.id)}
                      className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                        checked
                          ? "border-primary ring-1 ring-primary bg-primary/5"
                          : "border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/30"
                      }`}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <FileSpreadsheet size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{b.fileName}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {b.users.length} user{b.users.length === 1 ? "" : "s"} · {active} active ·
                          uploaded {new Date(b.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Geography */}

      <Card className="p-5 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Region</Label>
          <CascadingGeoPicker
            placeholder="Select regions (Zone → State → City)"
            selected={value.geographies}
            onToggle={toggleGeo}
            tree={geoTree}
            loading={geoLoading}
            error={geoError}
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
            tree={geoTree}
            loading={geoLoading}
            error={geoError}
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
