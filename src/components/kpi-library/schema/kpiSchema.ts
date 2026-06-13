// Config-driven KPI schema vocabulary.
//
// A KPI's entire editor UI is described by `KpiMeta` (metadata + an ordered list
// of `SectionSchema`). The generic `ConfigDrivenKpiCard` renderer reads this
// schema and renders/binds every section — there are no per-KPI components.
//
// Fields bind by `path` into the KPI's config value object (the existing
// NsvTemplateConfig / SimpleSlabConfig / LinesConfig / EcoConfig / etc. — whose
// shape is load-bearing for serialization and MUST NOT change). The schema only
// drives presentation; the stored value object is unchanged.
//
// "Add any KPI with any data points via config, zero code" holds for everything
// expressible with these section kinds. The only escape hatch is genuinely new
// *math* — earning ladders / max-payout / validation — which is referenced by a
// `computeId` resolved in computeRegistry.ts (see that file).

// ── Visibility predicate ─────────────────────────────────────────────────────
export interface VisibleWhen {
  path: string;
  equals?: unknown;
  in?: unknown[];
  truthy?: boolean;
}

// ── Field primitives (used inside `field-group` sections) ───────────────────
interface FieldBase {
  path: string;
  label?: string;
  help?: string;
  /** Render inline (label/control on one row) vs stacked. Default: stacked. */
  inline?: boolean;
  visibleWhen?: VisibleWhen | VisibleWhen[];
}
export interface NumberField extends FieldBase {
  kind: "number";
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}
export interface TextField extends FieldBase {
  kind: "text";
  placeholder?: string;
}
export interface TextareaField extends FieldBase {
  kind: "textarea";
  placeholder?: string;
  rows?: number;
}
export interface SwitchField extends FieldBase {
  kind: "switch";
  onLabel?: string;
  offLabel?: string;
}
export interface SelectField extends FieldBase {
  kind: "select";
  options?: Array<{ value: string; label: string }>;
  /** Resolve options at runtime from a named provider instead of `options`. */
  optionsSource?: "channels" | "roles" | "libraryKpis";
}
export interface SegmentedField extends FieldBase {
  kind: "segmented";
  options: Array<{ value: string; label: string }>;
}
export type Field =
  | NumberField
  | TextField
  | TextareaField
  | SwitchField
  | SelectField
  | SegmentedField;

// ── Section kinds ────────────────────────────────────────────────────────────
export type ComputeId =
  | "slabEarnings"
  | "simpleLadder"
  | "ecoLadder"
  | "linesLadder"
  | "aiReco";

interface SectionBase {
  id: string;
  title?: string;
  /** Auto-prefix a running "N · " number among visible numbered sections. */
  numbered?: boolean;
  visibleWhen?: VisibleWhen | VisibleWhen[];
  /** Render only when the role selector is shown (review views), not editors. */
  onlyWithRoleSelector?: boolean;
}

export interface FieldGroupSection extends SectionBase {
  kind: "field-group";
  fields: Field[];
  /** Grid columns for stacked fields. Default: fields render in a flex row. */
  columns?: 1 | 2 | 3;
  /** Optional muted helper line under the group. */
  note?: string;
}

export interface SlabsSection extends SectionBase {
  kind: "slabs";
  path: string; // "slabs"
  variant: "nsv" | "simple" | "eco";
  /** nsv variant only — bound to the step-up/slab toggle. */
  modePath?: string; // "stepMode"
  /** nsv variant — dynamic % column label (e.g. phasing cut-off day). */
  pctColumnLabel?: string;
  /** simple variant — drives unit prefix/suffix from a config value. */
  unitFromPath?: string; // "unit"
  unitLabel?: string; // e.g. "outlets", "calls / day"
}

export interface EarningLadderSection extends SectionBase {
  kind: "earning-ladder";
  computeId: ComputeId;
}

export interface GatesSection extends SectionBase {
  kind: "gates";
  selfId: string;
  enabledPath: string; // "gatesEnabled"
  gatesPath: string; // "gates"
  kpiNoun?: string; // "NSV" / "Phasing"
  showCollectionBasis?: boolean;
  showConsequence?: boolean;
}

export interface KeyNotesSectionSchema extends SectionBase {
  kind: "key-notes";
  path: string; // "keyNotes"
}

export interface TargetSourceSection extends SectionBase {
  kind: "target-source";
  sfaKey: string;
  basisPath: string; // "basis"
  secondarySourcePath: string; // "secondarySource"
  fileNamePath: string; // "targetFileName"
  statusPath: string; // "targetStatus"
}

export interface DbbProductsSection extends SectionBase {
  kind: "dbb-products";
  path: string; // "dbbProducts"
}

export interface AiRecoSection extends SectionBase {
  kind: "ai-reco";
  /** Ordered sub-metrics, each bound to a path (e.g. "crossSell", "recover"). */
  subMetrics: Array<{ path: string; title: string; subtitle: string }>;
}

export interface InfoSection extends SectionBase {
  kind: "info";
  /** Plain text; rendered as a muted callout. */
  text: string;
}

export type SectionSchema =
  | FieldGroupSection
  | SlabsSection
  | EarningLadderSection
  | GatesSection
  | KeyNotesSectionSchema
  | TargetSourceSection
  | DbbProductsSection
  | AiRecoSection
  | InfoSection;

// ── Per-KPI config object — one per KPI in the single config array ──────────
// Each KPI carries its own `tag` (segregation/group) and the ordered list of
// `sections` it renders. This is the whole KPI config: an array of these.
export interface KpiMeta {
  id: string;
  name: string;
  /** Segregation / group this KPI belongs to (e.g. "Sales Volume"). */
  tag: string;
  description: string;
  sample: string;
  cadenceLabel?: string; // "Monthly payout" / "Quarterly payout"
  /** Named math used for header max / summarize / earning ladders / validation. */
  computeId: ComputeId;
  /** Initial config value object (plain JSON; cloned per instance). */
  defaultConfig: unknown;
  /** Extra header badges as plain text (e.g. "Bill value: GSV"). */
  headerBadges?: string[];
  sections: SectionSchema[];
}
