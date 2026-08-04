import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { WizardStepper } from "./WizardStepper";
import { BasicsStep, isBasicsComplete } from "./steps/BasicsStep";
import { AudienceV2Step, isAudienceV2Complete } from "./steps/AudienceV2Step";
import { ProgramKpiStep } from "./steps/ProgramKpiStep";
import { GateRulesStep } from "./steps/GateRulesStep";
import { ReviewSimulateStep } from "./steps/ReviewSimulateStep";
import { emptyBuilder, type BuilderState, type WizardPrefill } from "./builderState";
import { ArrowLeft, ArrowRight, Check, Info, Loader2, Rocket, Save } from "lucide-react";
import {
  upsertDraft,
  deleteDraft,
  newDraftId,
  stepName,
  type WizardDraft,
} from "@/lib/wizardDraftStore";
import { useToast } from "@/hooks/use-toast";
import { saveProgram, newProgramId, quarterForMonth } from "@/lib/programStore";
import { buildRulePayloads } from "@/lib/rulePayload";
import { isCapInvalid } from "@/components/kpi-library/capValidation";
import { submitRules, updateRule } from "@/lib/ruleApi";
import { fetchChannelNames, fetchRolePayloadValues, fetchRoleDesignations } from "@/lib/saleshubApi";
import { friendlyMessage } from "@/lib/apiError";

const TOTAL_STEPS = 5;
const REVIEW_STEP = 5;

interface IncentiveWizardProps {
  onBack?: () => void;
  prefill?: WizardPrefill | null;
  // Called only after a successful go-live (rules synced / saved). Not called
  // when publishing fails.
  onPublished?: () => void;
}

export function IncentiveWizard({ onBack, prefill, onPublished }: IncentiveWizardProps) {
  const isDraft = prefill?.type === "draft";
  const startsAtReview =
    prefill?.startAtReview === true ||
    prefill?.type === "clone" ||
    prefill?.type === "template" ||
    prefill?.type === "clone-saved";
  // A resumed draft reopens on the step it was left on; everything else follows
  // the existing clone/template → Review shortcut.
  const initialStep =
    isDraft && typeof prefill?.atStep === "number"
      ? Math.min(Math.max(prefill.atStep, 1), TOTAL_STEPS)
      : startsAtReview
      ? REVIEW_STEP
      : 1;
  const [currentStep, setCurrentStep] = useState(initialStep);
  // Once the user has landed on / visited the review step, navigating away from
  // it (via stepper or section-edit pencil) swaps the footer "Next" CTA for a
  // "Back to review" CTA so the user doesn't have to walk the full flow again.
  const [reviewVisited, setReviewVisited] = useState(startsAtReview);
  const [autoOpenAddKpi, setAutoOpenAddKpi] = useState(false);
  const [state, setState] = useState<BuilderState>(() => {
    if (prefill?.type === "clone-saved" && prefill.builder) return prefill.builder as BuilderState;
    if (prefill?.builder) return prefill.builder as BuilderState;
    return emptyBuilder;
  });
  const { toast } = useToast();
  const publishingRef = useRef(false);

  // Stable draft id for this wizard session — resumed drafts keep their id so
  // autosave updates the same entry instead of piling up duplicates.
  const draftIdRef = useRef<string>(
    isDraft && prefill?.draftId ? prefill.draftId : newDraftId(),
  );
  // Once published, autosave stops so a finished programme can't be resurrected
  // as a draft.
  const publishedRef = useRef(false);

  const snapshotDraft = (): WizardDraft => ({
    id: draftIdRef.current,
    name: state.basics.name?.trim() || "Untitled programme",
    atStep: currentStep,
    builder: state,
    updatedAt: new Date().toISOString(),
  });

  // Has the user actually authored anything worth keeping? Opening the wizard
  // alone mutates state (channels arrive from SalesHub on mount), so without
  // this an untouched visit would leave an "Untitled programme" draft behind.
  // A resumed draft always keeps saving — it already exists.
  const hasAuthoredContent =
    isDraft ||
    !!state.basics.name.trim() ||
    !!state.audience.division ||
    state.audience.roles.length > 0 ||
    state.audience.geographies.length > 0 ||
    state.programKpis.length > 0 ||
    state.gates.length > 0;

  // Subtle auto-save indicator. Any change to the builder or step flips to
  // "saving", then persists and settles to "saved" after a short debounce.
  // Skips the very first render so simply opening the wizard doesn't create a
  // draft before the user has typed anything.
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!hasAuthoredContent) return;
    setSaveStatus("saving");
    const t = setTimeout(() => {
      if (!publishedRef.current) upsertDraft(snapshotDraft());
      setSaveStatus("saved");
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, currentStep, hasAuthoredContent]);

  const saveAndExit = () => {
    if (hasAuthoredContent) {
      upsertDraft(snapshotDraft());
      toast({
        title: "Draft saved",
        description: `Pick up from ${stepName(currentStep)} anytime from Programmes.`,
      });
    } else {
      toast({ title: "Nothing to save yet", description: "Add some details first." });
    }
    onBack?.();
  };

  // Fetch channels from SalesHub on mount. If the call fails, channels stay
  // empty — no default/fallback channels are shown.
  useEffect(() => {
    fetchChannelNames()
      .then((names) => setState((s) => ({ ...s, channels: names })))
      .catch(() => { /* leave channels empty on failure */ });
    // Warm the role → API value mapping so buildRulePayloads can resolve it,
    // including clone/template flows that start straight on the Review step.
    fetchRolePayloadValues().catch(() => { /* non-fatal */ });
    // Warm the role → designation mapping for user_filters.
    fetchRoleDesignations().catch(() => { /* non-fatal */ });
  }, []);

  // Dev aid: log the /v1/rules payload built from the current form state each
  // time the user moves between steps, so payloads can be eyeballed while
  // testing different inputs. Runs on step change, not on every keystroke.
  useEffect(() => {
    console.log(`[Create Program] step ${currentStep}/${TOTAL_STEPS}`, {
      // Everything the user has entered so far — always populated.
      formState: state,
      // One /v1/rules rule per KPI — stays [] until a KPI is added on the KPI step.
      rulesPayload: buildRulePayloads(state),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const goLive = async () => {
    if (publishingRef.current) return;
    publishingRef.current = true;
    const q = quarterForMonth(state.basics.month, state.basics.year);
    saveProgram({
      id: newProgramId(),
      name: state.basics.name || "Untitled programme",
      channel: state.audience.division,
      role: state.audience.roles[0] || "—",
      geographies: state.audience.geographies,
      geographyExceptions: state.audience.geographyExceptions,
      monthYear: { month: state.basics.month, year: state.basics.year },
      quarterLabel: q.full,
      attainmentBasis: state.basics.attainmentBasis,
      currency: state.basics.currency,
      payoutFrequency: state.basics.payoutFrequency,
      channels: state.channels,
      kpiGroups: state.kpiGroups,
      kpis: state.programKpis.map((k) => ({
        templateId: k.templateId,
        instanceId: k.instanceId,
        config: k.config,
        customName: k.customName,
        groupIds: k.groupIds,
        scope: k.scope,
      })),
      gates: state.gates,
      createdAt: new Date().toISOString(),
    });
    // The programme now exists locally, so its draft has served its purpose.
    // Stop autosave first so the debounce can't write it back.
    publishedRef.current = true;
    deleteDraft(draftIdRef.current);
    try {
      const payloads = buildRulePayloads(state);
      const editRuleId = prefill?.editRuleId;
      if (payloads.length > 0) {
        if (editRuleId) {
          // Editing an existing rule → PUT it in place with the first payload.
          // Any additional KPIs added during the edit have no rule yet, so they're
          // POSTed as new rules.
          await updateRule(editRuleId, payloads[0]);
          if (payloads.length > 1) await submitRules(payloads.slice(1));
        } else {
          await submitRules(payloads);
        }
        toast({
          title: editRuleId ? "✅ Programme updated!" : "🚀 Programme is live!",
          description:
            payloads.length > 1
              ? `Saved to All Programs · ${payloads.length} rules sent to the incentive engine.`
              : "Saved to All Programs · synced to the incentive engine.",
        });
      } else {
        toast({ title: "🚀 Programme is live!", description: "Saved to All Programs." });
      }
      // Published successfully — hand off (WizardRoute navigates to active campaigns).
      onPublished?.();
    } catch (err) {
      // Raw backend text is for the console, never the user.
      console.error("[publish] rule sync failed:", err);
      toast({
        title: "Couldn't publish to the incentive engine",
        description: `${friendlyMessage(err, "publish this programme")} Your programme is saved and nothing is lost.`,
        variant: "destructive",
      });
    } finally {
      publishingRef.current = false;
    }
  };

  const update = <K extends keyof BuilderState>(k: K, v: BuilderState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const selectedRole = state.audience.roles[0] || "";
  const lockedRole: "mr" | "aso" | undefined = /aso|ase/i.test(selectedRole)
    ? "aso"
    : /mr/i.test(selectedRole)
    ? "mr"
    : undefined;

  // Editing/cloning/templating starts from an already-formed programme handed in
  // via `prefill.builder`. The rules-API record it's rebuilt from can't always
  // recover every field (e.g. audience division/geography), so the sequential
  // gating below would wrongly lock the user out of navigating between steps.
  // For those prefilled flows, treat every step as reachable.
  //
  // A resumed draft is exempt: it's a loss-free local snapshot of a part-built
  // programme, so the normal completeness gating still applies to it.
  const prefilled = !!prefill?.builder && !isDraft;

  // Sequential gating (first-time creation only): a step is reachable only once
  // every mandatory step before it is complete (Basics → Audience → KPIs). Gates
  // is optional, so Gates and Review unlock together once Basics + Audience +
  // ≥1 KPI are done.
  const maxReachableStep = prefilled
    ? TOTAL_STEPS
    : !isBasicsComplete(state.basics)
    ? 1
    : !isAudienceV2Complete(state.audience)
    ? 2
    : state.programKpis.length === 0
    ? 3
    : TOTAL_STEPS;

  const goToStep = (n: number) => {
    if (n > maxReachableStep) return; // blocked until earlier mandatory steps pass
    if (n === REVIEW_STEP) setReviewVisited(true);
    setCurrentStep(n);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <BasicsStep value={state.basics} onChange={(v) => update("basics", v)} channels={state.channels} onChannelsChange={(v) => update("channels", v)} />;
      case 2: return <AudienceV2Step value={state.audience} onChange={(v) => update("audience", v)} />;
      case 3: return <ProgramKpiStep
          value={state.programKpis}
          onChange={(v) => update("programKpis", v)}
          groups={state.kpiGroups}
          onGroupsChange={(v) => update("kpiGroups", v)}
          channels={state.channels}
          audience={state.audience}
          lockedRole={lockedRole}
          autoOpenAdd={autoOpenAddKpi}
          onAutoOpenAddHandled={() => setAutoOpenAddKpi(false)}
        />;
      case 4: return <GateRulesStep value={state.gates} onChange={(v) => update("gates", v)} kpis={state.kpis} audience={state.audience} />;
      case 5: return <ReviewSimulateStep
          state={state}
          onKpisChange={(v) => update("programKpis", v)}
          onGroupsChange={(v) => update("kpiGroups", v)}
          onJumpToAddKpi={() => { setAutoOpenAddKpi(true); goToStep(3); }}
          onEditStep={(n) => goToStep(n)}
          lockedRole={lockedRole}
        />;
      default: return null;
    }
  };

  // In a prefilled (edit/clone/template) flow the programme is already complete,
  // so the per-step "Next" / "Back to review" CTA must never be blocked — that
  // block is what otherwise traps the user on a step they jumped in to edit.
  const nextDisabled =
    !prefilled &&
    ((currentStep === 1 && !isBasicsComplete(state.basics)) ||
      (currentStep === 2 && !isAudienceV2Complete(state.audience)) ||
      (currentStep === 3 &&
        (state.programKpis.length === 0 ||
          state.programKpis.some((k) => isCapInvalid(k.config)))));

  // Publishing is gated on the same three mandatory sections the Review step
  // reports on. The guard lives here now that Review's own publish button is
  // gone and the footer "Go Live" CTA is the only way to publish.
  const canPublish =
    isBasicsComplete(state.basics) &&
    isAudienceV2Complete(state.audience) &&
    state.programKpis.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white p-4 sm:p-5">
      <div className="wizard-surface surface-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
        {prefill && prefill.type && (
          <div className="flex items-center gap-2 border-b border-hairline bg-sidebar-active/60 px-6 py-2.5">
            <Info size={15} className="text-primary" />
            <span className="text-sm text-sidebar-active-foreground">
              {prefill.type === "clone-saved" && `Cloned from saved programme — modify and publish`}
              {prefill.type === "clone" && `Cloned from: ${prefill.name}`}
              {prefill.type === "template" && `Template: ${prefill.name}`}
              {prefill.type === "draft" && `Resumed draft — picking up from ${stepName(initialStep)}`}
            </span>
          </div>
        )}

        {/* Step navigation */}
        <div className="border-b border-hairline">
          <WizardStepper currentStep={currentStep} onStepClick={goToStep} maxStep={maxReachableStep} />
        </div>

        {/* Airy scrollable canvas */}
        <div className="wizard-signal-bg relative min-h-0 flex-1 overflow-y-auto px-6 py-7">
          <div className="relative z-10 mx-auto max-w-5xl animate-fade-in">{renderStep()}</div>
        </div>

        {/* Sticky action bar */}
        <div className="z-20 flex shrink-0 items-center justify-between gap-4 border-t border-hairline bg-card px-6 py-3.5">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={currentStep === 1}
              onClick={() => goToStep(currentStep - 1)}
            >
              <ArrowLeft size={15} /> Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={saveAndExit}
              title="Save draft and exit — resume from this step later"
            >
              <Save size={15} /> Save &amp; exit
            </Button>
            {onBack && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onBack}>
                All programmes
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Step {currentStep} of {TOTAL_STEPS}</span>
            <span aria-hidden className="h-3 w-px bg-border" />
            {saveStatus === "saving" ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Saving…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Check size={12} className="text-primary" /> Draft saved
              </span>
            )}
          </div>

          {currentStep === REVIEW_STEP ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={goLive}
              disabled={!canPublish}
              title={canPublish ? undefined : "Complete Basics, Audience and KPIs first"}
            >
              <Rocket size={15} /> Go Live
            </Button>
          ) : reviewVisited ? (
            <Button size="sm" className="gap-1.5" onClick={() => goToStep(REVIEW_STEP)} disabled={nextDisabled}>
              Back to review <ArrowRight size={15} />
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={() => goToStep(currentStep + 1)} disabled={nextDisabled}>
              Next <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
