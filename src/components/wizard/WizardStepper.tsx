import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";

export const WIZARD_STEPS = [
  { id: 1, label: "Basics", description: "Programme basics", optional: false },
  { id: 2, label: "Audience", description: "Who this programme is for", optional: false },
  { id: 3, label: "KPIs", description: "Build KPIs & payouts", optional: false },
  { id: 4, label: "Gates", description: "Conditional rules", optional: false },
  { id: 5, label: "Review", description: "Review & simulate", optional: false },
] as const;

interface WizardStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  /** Highest step the user may jump to; later steps are locked until prerequisites pass. */
  maxStep?: number;
}

export function WizardStepper({ currentStep, onStepClick, maxStep = WIZARD_STEPS.length }: WizardStepperProps) {
  return (
    <div className="bg-card border-b border-border px-6 py-3">
      <div className="flex items-start gap-1 w-[65%]">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          const locked = step.id > maxStep && !isActive;
          return (
            <div key={step.id} className="flex items-start flex-1">
              <button
                onClick={() => { if (!locked) onStepClick(step.id); }}
                disabled={locked}
                title={locked ? "Complete the earlier steps first" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1 rounded-md transition-all min-w-0 flex-1",
                  locked ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
                    isActive && "bg-primary text-primary-foreground shadow-sm",
                    isComplete && "bg-primary/80 text-primary-foreground",
                    !isActive && !isComplete && "bg-muted text-muted-foreground"
                  )}
                >
                  {locked ? <Lock size={11} /> : isComplete ? <Check size={12} /> : step.id}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium leading-tight text-center",
                    isActive && "text-primary",
                    isComplete && "text-primary/70",
                    !isActive && !isComplete && "text-muted-foreground"
                  )}
                >
                  {step.label}
                  {step.optional && (
                    <span className="ml-1 text-[9px] uppercase tracking-wide text-muted-foreground/70">(opt)</span>
                  )}
                </span>
              </button>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 mt-3 mx-0.5",
                    isComplete ? "bg-primary/60" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
