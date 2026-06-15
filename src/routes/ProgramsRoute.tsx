import { useNavigate } from "react-router-dom";
import { ProgramsPage } from "@/pages/ProgramsPage";
import { programmeToBuilder } from "@/components/clone/programmeToBuilder";
import { getSourceRule } from "@/lib/ruleToProgramme";
import { ruleToBuilder } from "@/lib/ruleToBuilder";
import type { Programme } from "@/types/programme";
import type { BuilderState, WizardPrefill } from "@/components/wizard/builderState";

/** Programs list — the app's home route. Wires its callbacks to navigation. */
export function ProgramsRoute() {
  const navigate = useNavigate();

  // Rebuild full wizard state from the program's source rule (which carries the
  // real division/channels/zones/period/KPI); fall back to the lossy Programme.
  const builderFor = (programme: Programme): BuilderState => {
    const rule = getSourceRule(programme);
    // DEBUG (temporary): confirms the source rule is found so edit uses the rich
    // ruleToBuilder path. Should log `true → ruleToBuilder` with roles + ≥1 KPI.
    console.log(
      `[edit-debug] builderFor "${programme.name}": hasSourceRule=${!!rule} →`,
      rule ? "ruleToBuilder" : "programmeToBuilder",
    );
    return rule ? ruleToBuilder(rule) : programmeToBuilder(programme);
  };

  return (
    <ProgramsPage
      onCreateNew={() => navigate("/create/wizard")}
      onOpenProgram={(programme) => {
        // Edit a draft → open the wizard at Review with every step pre-populated.
        const builder = builderFor(programme);
        const prefill: WizardPrefill = {
          name: programme.name,
          builder: { ...builder, basics: { ...builder.basics, name: programme.name } },
          startAtReview: true,
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
    />
  );
}
