import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProgramsPage, type StatusFilter } from "@/pages/ProgramsPage";
import { programmeToBuilder } from "@/components/clone/programmeToBuilder";
import { getSourceRules } from "@/lib/ruleToProgramme";
import { rulesToBuilder } from "@/lib/ruleToBuilder";
import type { Programme } from "@/types/programme";
import type { BuilderState, WizardPrefill } from "@/components/wizard/builderState";
import { listDrafts, getDraft, deleteDraft, type WizardDraft } from "@/lib/wizardDraftStore";

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "active",
  "scheduled",
  "draft",
  "completed",
  "inactive",
];

/** Programs list — the app's home route. Wires its callbacks to navigation. */
export function ProgramsRoute() {
  const navigate = useNavigate();

  // On /campaigns/:status the URL owns the status filter, so the sidebar
  // highlight, the URL and the list's dropdown always agree. An unrecognised
  // segment falls back to "all" rather than showing an empty list.
  const { status } = useParams<{ status?: string }>();
  const routeStatus: StatusFilter | undefined =
    status === undefined
      ? undefined
      : STATUS_FILTERS.includes(status as StatusFilter)
      ? (status as StatusFilter)
      : "all";

  // Wizard drafts live in localStorage; the store broadcasts on every write so
  // the list stays current while this page is open (e.g. after a discard).
  const [drafts, setDrafts] = useState<WizardDraft[]>(() => listDrafts());
  useEffect(() => {
    const refresh = () => setDrafts(listDrafts());
    window.addEventListener("wizardDrafts:change", refresh);
    return () => window.removeEventListener("wizardDrafts:change", refresh);
  }, []);

  // Rebuild full wizard state from the programme's source rules — one per KPI, all
  // carrying the real division/channels/zones/period — so an edit or clone opens
  // with every KPI, not just the first. Falls back to the lossy Programme.
  const builderFor = (programme: Programme): BuilderState => {
    const rules = getSourceRules(programme);
    // DEBUG (temporary): confirms the source rules are found so edit uses the rich
    // rulesToBuilder path. Should log `N → rulesToBuilder` with roles + N KPIs.
    console.log(
      `[edit-debug] builderFor "${programme.name}": sourceRules=${rules.length} →`,
      rules.length ? "rulesToBuilder" : "programmeToBuilder",
    );
    return rules.length ? rulesToBuilder(rules) : programmeToBuilder(programme);
  };

  return (
    <ProgramsPage
      onCreateNew={() => navigate("/create/wizard")}
      onOpenProgram={(programme) => {
        // Edit a draft → open the wizard at Review with every step pre-populated.
        const builder = builderFor(programme);
        // Carry every source rule id, in the same order as the KPIs the builder was
        // rebuilt from, so publishing PUTs each existing rule in place instead of
        // POSTing duplicates. Falls back to POST (no ids) when they can't be resolved.
        const editRuleIds = getSourceRules(programme)
          .map((r) => r.id ?? r.ruleId)
          .filter((id): id is string => !!id);
        const prefill: WizardPrefill = {
          name: programme.name,
          builder: { ...builder, basics: { ...builder.basics, name: programme.name } },
          startAtReview: true,
          ...(editRuleIds.length ? { editRuleIds } : {}),
        };
        navigate("/create/wizard", { state: { prefill } });
      }}
      onCloneProgram={(programme) => {
        // Clone → open the wizard at Review with every step pre-populated.
        const builder = builderFor(programme);
        const prefill: WizardPrefill = {
          type: "clone",
          name: programme.name,
          builder: { ...builder, basics: { ...builder.basics, name: `${programme.name} — Copy` } },
          startAtReview: true,
        };
        navigate("/create/wizard", { state: { prefill } });
      }}
      onCloneMultiple={(ids) =>
        navigate(`/clone/quick-review?ids=${ids.map(encodeURIComponent).join(",")}`)
      }
      onViewAnalytics={(id) => navigate(`/programs/${encodeURIComponent(id)}/analytics`)}
      drafts={drafts.map((d) => ({
        id: d.id,
        name: d.name,
        atStep: d.atStep,
        updatedAt: d.updatedAt,
      }))}
      onResumeDraft={(id) => {
        const draft = getDraft(id);
        if (!draft) return;
        const prefill: WizardPrefill = {
          type: "draft",
          draftId: draft.id,
          name: draft.name,
          builder: draft.builder,
          atStep: draft.atStep,
        };
        navigate("/create/wizard", { state: { prefill } });
      }}
      onDiscardDraft={(id) => deleteDraft(id)}
      statusFilter={routeStatus}
      onStatusFilterChange={
        routeStatus === undefined
          ? undefined
          : (v) => navigate(`/campaigns/${v}`)
      }
    />
  );
}
