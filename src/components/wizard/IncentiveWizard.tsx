import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { WizardStepper } from "./WizardStepper";
import { BasicsStep, isBasicsComplete } from "./steps/BasicsStep";
import { AudienceV2Step, isAudienceV2Complete } from "./steps/AudienceV2Step";
import { ProgramKpiStep } from "./steps/ProgramKpiStep";
import { GateRulesStep } from "./steps/GateRulesStep";
import { ReviewSimulateStep } from "./steps/ReviewSimulateStep";
import { emptyBuilder, type BuilderState, type WizardPrefill } from "./builderState";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveProgram, newProgramId, quarterForMonth } from "@/lib/programStore";
import { buildRulePayloads } from "@/lib/rulePayload";
import { isCapInvalid } from "@/components/kpi-library/capValidation";
import { submitRules } from "@/lib/ruleApi";
import { fetchChannelNames, fetchRolePayloadValues, fetchRoleDesignations } from "@/lib/saleshubApi";

const TOTAL_STEPS = 5;
const REVIEW_STEP = 5;

interface IncentiveWizardProps {
  onBack?: () => void;
  prefill?: WizardPrefill | null;
  onPublished?: () => void;
}

export function IncentiveWizard({ onBack, prefill, onPublished }: IncentiveWizardProps) {
  const startsAtReview =
    prefill?.startAtReview === true ||
    prefill?.type === "clone" ||
    prefill?.type === "template" ||
    prefill?.type === "clone-saved";
  const [currentStep, setCurrentStep] = useState(startsAtReview ? REVIEW_STEP : 1);
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
    try {
      const payloads = buildRulePayloads(state);
      if (payloads.length > 0) {
        await submitRules(payloads);
        toast({
          title: "🚀 Programme is live!",
          description:
            payloads.length > 1
              ? `Saved to All Programs · ${payloads.length} rules sent to the incentive engine.`
              : "Saved to All Programs · synced to the incentive engine.",
        });
      } else {
        toast({ title: "🚀 Programme is live!", description: "Saved to All Programs." });
      }
    } catch (err) {
      toast({
        title: "Saved locally — rule sync failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      publishingRef.current = false;
      onPublished?.();
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
  // For any prefilled flow, treat every step as reachable.
  const prefilled = !!prefill?.builder;

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
          onGoLive={goLive}
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

  return (
    <div className="flex flex-col h-full">
      {prefill && prefill.type && (
        <div className="bg-primary/5 border-b border-primary/20 px-6 py-2 flex items-center gap-2">
          <Info size={14} className="text-primary" />
          <span className="text-xs text-primary font-medium">
            {prefill.type === "clone-saved" && `Cloned from saved programme — modify and publish`}
            {prefill.type === "clone" && `Cloned from: ${prefill.name}`}
            {prefill.type === "template" && `Template: ${prefill.name}`}
          </span>
        </div>
      )}

      <WizardStepper currentStep={currentStep} onStepClick={goToStep} maxStep={maxReachableStep} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">{renderStep()}</div>
      </div>

      <div className="border-t border-border bg-card px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          {onBack && <Button variant="ghost" size="sm" className="text-xs" onClick={onBack}>← All Programs</Button>}
          <Button variant="outline" size="sm" className="text-xs gap-1" disabled={currentStep === 1} onClick={() => goToStep(currentStep - 1)}>
            <ArrowLeft size={14} /> Previous
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">Step {currentStep} of {TOTAL_STEPS}</span>
        {currentStep === REVIEW_STEP ? (
          <Button size="sm" className="text-xs gap-1" onClick={goLive}>🚀 Go Live</Button>
        ) : reviewVisited ? (
          <Button size="sm" className="text-xs gap-1" onClick={() => goToStep(REVIEW_STEP)} disabled={nextDisabled}>
            Back to review <ArrowRight size={14} />
          </Button>
        ) : (
          <Button size="sm" className="text-xs gap-1" onClick={() => goToStep(currentStep + 1)} disabled={nextDisabled}>
            Next <ArrowRight size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
