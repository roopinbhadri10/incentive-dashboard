import { useNavigate, useSearchParams } from "react-router-dom";
import { CreateProgramHub } from "@/components/wizard/CreateProgramHub";
import type { WizardPrefill } from "@/components/wizard/builderState";

/**
 * Create-program hub. An optional `?clone=<planId>` query param opens the hub
 * straight on the clone tab with that plan pre-selected.
 */
export function CreateHubRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clonePlanId = params.get("clone") ?? undefined;

  return (
    <CreateProgramHub
      initialTab={clonePlanId ? "clone" : undefined}
      initialClonePlanId={clonePlanId}
      onBack={() => navigate("/programs")}
      onSelectPath={(path, data) => {
        if (path === "blank") {
          navigate("/create/wizard");
        } else if (path === "clone" || path === "template") {
          const prefill: WizardPrefill = { type: path, ...data };
          navigate("/create/wizard", { state: { prefill } });
        }
      }}
    />
  );
}
