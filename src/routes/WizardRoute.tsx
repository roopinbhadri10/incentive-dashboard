import { useLocation, useNavigate } from "react-router-dom";
import { IncentiveWizard } from "@/components/wizard/IncentiveWizard";
import type { WizardPrefill } from "@/components/wizard/builderState";

interface WizardLocationState {
  prefill?: WizardPrefill | null;
}

/**
 * Incentive wizard. Clone/template flows hand off a `prefill` via router
 * location state; opened directly (e.g. "Create new" in the sidebar) it starts
 * from a blank builder.
 */
export function WizardRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as WizardLocationState | null)?.prefill ?? null;

  return (
    <IncentiveWizard
      prefill={prefill}
      onBack={() => navigate("/programs")}
      onPublished={() => navigate("/campaigns/active")}
    />
  );
}
