import { Lightbulb } from "lucide-react";

interface WizardSidebarProps {
  currentStep: number;
}

const stepTips: Record<number, string> = {
  1: "Narrow your coverage by region and territory for more targeted incentives. Programs with focused coverage show 30% higher attainment.",
  2: "Programs with 2+ KPIs show 23% higher attainment. Consider adding a SKUs per Outlet KPI to improve ROI by ~15%.",
  3: "Selecting 3–5 SKUs per program keeps reps focused. Too many dilutes effort across products.",
  4: "Tiered payouts drive 40% more effort than flat payouts. Consider 3 tiers: base, stretch, and super-stretch.",
  5: "Programs with both banner + push notification see 2x higher awareness among reps in the first week.",
  6: "Smart reminders at 50% and 80% attainment milestones drive the highest incremental effort from reps.",
};

export function WizardSidebar({ currentStep }: WizardSidebarProps) {
  const tip = stepTips[currentStep] || stepTips[1];

  return (
    <div className="w-72 border-l border-border bg-card p-4 overflow-y-auto shrink-0 hidden lg:block">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Lightbulb size={12} className="text-primary" />
          <span className="text-[10px] font-semibold text-primary">Tip</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {tip}
        </p>
      </div>
    </div>
  );
}
