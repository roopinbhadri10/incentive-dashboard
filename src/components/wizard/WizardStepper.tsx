import { cn } from "@/lib/utils";
import {
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Lock,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";

export const WIZARD_STEPS = [
  { id: 1, label: "Basics", description: "Programme basics", optional: false, icon: FileText },
  { id: 2, label: "Audience", description: "Who this programme is for", optional: false, icon: Users },
  { id: 3, label: "KPIs", description: "Build KPIs & payouts", optional: false, icon: Target },
  { id: 4, label: "Gates", description: "Conditional rules", optional: false, icon: ShieldCheck },
  { id: 5, label: "Review", description: "Review & simulate", optional: false, icon: ClipboardCheck },
] as const;

interface WizardStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  /** Highest step the user may jump to; later steps are locked until prerequisites pass. */
  maxStep?: number;
}

/**
 * Breadcrumb-chip step navigation, matching the SFA configurator reference:
 * icon + label chips separated by chevrons, teal underline for the active step,
 * check mark for completed steps, quiet grey for upcoming ones. Steps beyond
 * `maxStep` stay locked until their prerequisites pass.
 */
export function WizardStepper({ currentStep, onStepClick, maxStep = WIZARD_STEPS.length }: WizardStepperProps) {
  return (
    <nav
      aria-label="Programme setup steps"
      className="wizard-breadcrumb relative flex items-center gap-0.5 overflow-x-auto px-5"
    >
      {WIZARD_STEPS.map((step, index) => {
        const isActive = currentStep === step.id;
        const isComplete = currentStep > step.id;
        const locked = step.id > maxStep && !isActive;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center shrink-0">
            {index > 0 && (
              <ChevronRight
                size={15}
                className={cn("mx-0.5 shrink-0", isComplete || isActive ? "text-primary/40" : "text-muted-foreground/40")}
              />
            )}
            <button
              type="button"
              onClick={() => { if (!locked) onStepClick(step.id); }}
              disabled={locked}
              aria-current={isActive ? "step" : undefined}
              title={locked ? "Complete the earlier steps first" : step.description}
              className={cn(
                "group relative inline-flex items-center gap-2 px-2.5 py-3 text-sm transition-colors",
                isActive && "font-medium text-primary",
                !isActive && isComplete && "text-foreground/70 hover:text-foreground",
                !isActive && !isComplete && "text-muted-foreground hover:text-foreground",
                locked && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center transition-colors",
                  isComplete && !isActive && "text-primary",
                  isActive && "text-primary",
                  !isActive && !isComplete && "text-muted-foreground/70",
                )}
              >
                {locked ? <Lock size={13} /> : isComplete && !isActive ? <Check size={13} strokeWidth={3} /> : <Icon size={15} />}
              </span>
              <span className="whitespace-nowrap leading-none">{step.label}</span>
              {step.optional && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                  opt
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
