import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { QuickCloneReview } from "@/components/clone/QuickCloneReview";
import { mockProgrammes } from "@/data/mockData";
import type { Programme } from "@/types/programme";
import type { WizardPrefill } from "@/components/wizard/builderState";

/**
 * Quick clone review for a batch of programmes selected on the programs list.
 * The selection travels in the URL as `?ids=a,b,c` so the view survives reload.
 */
export function QuickCloneRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const programs = ids
    .map((id) => mockProgrammes.find((p) => p.id === id))
    .filter((p): p is Programme => Boolean(p));

  if (programs.length === 0) return <Navigate to="/programs" replace />;

  return (
    <QuickCloneReview
      programs={programs}
      onBack={() => navigate("/programs")}
      onPublish={() => {
        const n = programs.length;
        navigate("/programs");
        toast.success(`${n} program${n === 1 ? "" : "s"} published`, {
          description: "Cloned with your tweaks — ready in your list",
        });
      }}
      onOpenInWizard={(program) => {
        const prefill: WizardPrefill = { type: "clone", name: program.name, ...program };
        navigate("/create/wizard", { state: { prefill } });
      }}
    />
  );
}
