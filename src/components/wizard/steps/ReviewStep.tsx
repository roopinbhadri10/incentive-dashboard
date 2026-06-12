import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Check, Edit2, Rocket, Sparkles } from "lucide-react";
import { KpiPayoutMatrix } from "@/components/programs/KpiPayoutMatrix";
import type { ProgramKPI } from "@/data/mockData";

interface ReviewStepProps {
  onGoLive: () => void;
  onEditStep?: (step: number) => void;
}

const stepMap: Record<string, number> = {
  Coverage: 1,
  KPIs: 2,
  "Focus Products": 3,
  "Payout Structure": 4,
  Communication: 5,
  Reminders: 6,
};

// Sample KPI payout matrix matching the wizard's PayoutStep defaults.
const reviewKpis: ProgramKPI[] = [
  {
    name: "Revenue Target",
    target: "₹2L/rep",
    weight: 50,
    attainment: 0,
    payoutTiers: [
      { label: "Tier 1", minAttainment: 80, maxAttainment: 100, payoutPerRep: 2500 },
      { label: "Tier 2", minAttainment: 100, maxAttainment: 120, payoutPerRep: 4000 },
      { label: "Tier 3", minAttainment: 120, maxAttainment: 150, payoutPerRep: 6000 },
    ],
  },
  {
    name: "Numeric Distribution",
    target: "85% stores",
    weight: 50,
    attainment: 0,
    payoutTiers: [
      { label: "Tier 1", minAttainment: 80, maxAttainment: 100, payoutPerRep: 2500 },
      { label: "Tier 2", minAttainment: 100, maxAttainment: 120, payoutPerRep: 4000 },
      { label: "Tier 3", minAttainment: 120, maxAttainment: 150, payoutPerRep: 6000 },
    ],
  },
];

export function ReviewStep({ onGoLive, onEditStep }: ReviewStepProps) {
  const sections = [
    {
      title: "Coverage",
      items: ["North Region", "2 Sales Reps selected", "78 total outlets covered"],
    },
    {
      title: "KPIs",
      items: ["Revenue Target", "Numeric Distribution"],
    },
    {
      title: "Focus Products",
      items: ["Coca Cola 250ml", "Sprite 300ml", "Fanta 250ml"],
    },
    {
      title: "Payout Structure",
      items: ["Total Budget: ₹5,00,000", "Mode: Cash", "2 KPIs × 3 tiers — see matrix below"],
    },
    {
      title: "Communication",
      items: ["In-app banner configured", "Push notification ready", "Pre-launch: 3 days notice"],
    },
    {
      title: "Reminders",
      items: ["5 reminder rules configured", "Milestones at 25%, 50%, 75%, 100%", "1 no-progress reminder"],
    },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      {/* AI Score */}
      <div className="gradient-banner rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Sparkles size={18} className="text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-foreground">Plan Health Score: 92/100</p>
            <p className="text-xs text-primary-foreground/80">
              This plan looks well-structured! Consider adding a <strong>SKUs per Outlet KPI</strong> to improve ROI by an estimated 15%.
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">Excellent</Badge>
      </div>

      {/* Plan Summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Plan Summary</h3>
          <Badge variant="outline" className="text-xs">Draft</Badge>
        </div>
        <Input
          defaultValue="Summer Push - Carbonated Q2 2025"
          className="text-sm font-medium mb-3"
          placeholder="Plan name"
        />
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-lg font-bold">234</p>
            <p className="text-[10px] text-muted-foreground">Est. Participants</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-lg font-bold">₹5L</p>
            <p className="text-[10px] text-muted-foreground">Total Budget</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-lg font-bold">72%</p>
            <p className="text-[10px] text-muted-foreground">Est. Attainment</p>
          </div>
        </div>
        <Separator className="my-3" />
        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.title} className="flex items-start gap-2">
              <Check size={14} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{section.title}</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onEditStep?.(stepMap[section.title] || 1)}>
                    <Edit2 size={10} className="text-muted-foreground" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {section.items.map((item) => (
                    <Badge key={item} variant="secondary" className="text-[10px]">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* KPI × Tier Payout Matrix */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Payout Schedule — KPI × Tier</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Reps earn the sum of payouts for every KPI tier they hit.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onEditStep?.(4)}
          >
            <Edit2 size={11} className="text-muted-foreground" />
          </Button>
        </div>
        <KpiPayoutMatrix kpis={reviewKpis} compact showTotals />
      </Card>

      {/* Go Live */}
      <div className="flex justify-between items-center pt-2">
        <Button variant="outline" className="text-xs">Save as Draft</Button>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs">Schedule for Later</Button>
          <Button className="text-xs gap-1" onClick={onGoLive}>
            <Rocket size={14} /> Go Live Now
          </Button>
        </div>
      </div>
    </div>
  );
}
