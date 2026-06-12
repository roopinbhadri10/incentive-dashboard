import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Plus, Sparkles, Trash2 } from "lucide-react";

interface NudgeRule {
  id: number;
  trigger: string;
  attainmentPercent: number;
  type: "positive" | "push" | "reminder";
  message: string;
  enabled: boolean;
}

export function NudgeStep() {
  const [nudges, setNudges] = useState<NudgeRule[]>([
    { id: 1, trigger: "attainment_reached", attainmentPercent: 25, type: "positive", message: "Great start, {name}! 🎉 You've hit 25% of your target. Keep pushing!", enabled: true },
    { id: 2, trigger: "attainment_reached", attainmentPercent: 50, type: "positive", message: "Halfway there! 🔥 You've earned ₹2,500 so far. Push for the next tier!", enabled: true },
    { id: 3, trigger: "attainment_reached", attainmentPercent: 75, type: "push", message: "Almost there! 💪 Just 25% more to unlock the ₹8,000 payout tier!", enabled: true },
    { id: 4, trigger: "attainment_reached", attainmentPercent: 100, type: "positive", message: "🏆 Target achieved! You've earned ₹8,000. Can you push for the next bonus tier?", enabled: true },
    { id: 5, trigger: "no_progress", attainmentPercent: 0, type: "reminder", message: "Hey {name}, your incentive plan is active but we haven't seen progress yet. Need help?", enabled: true },
  ]);

  const typeColors: Record<string, string> = {
    positive: "highlight-green",
    push: "highlight-yellow",
    reminder: "highlight-blue",
  };

  const typeLabels: Record<string, string> = {
    positive: "🎉 Positive",
    push: "💪 Push",
    reminder: "🔔 Reminder",
  };

  const updateNudge = (id: number, updates: Partial<NudgeRule>) => {
    setNudges((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const removeNudge = (id: number) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
  };

  const addNudge = () => {
    setNudges([...nudges, {
      id: Date.now(),
      trigger: "attainment_reached",
      attainmentPercent: 0,
      type: "positive",
      message: "",
      enabled: true,
    }]);
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* AI Suggestion */}
      <div className="gradient-banner rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Sparkles size={18} className="text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-foreground">Smart Reminder Setup</p>
            <p className="text-xs text-primary-foreground/80">
              AI has pre-configured optimal reminder points based on your payout tiers. Plans with <strong>milestone reminders at 25%, 50%, 75%</strong> see 28% higher completion rates.
            </p>
          </div>
        </div>
      </div>

      {/* Nudge Timeline Visual */}
      <Card className="p-4">
        <label className="text-sm font-medium mb-3 block">Reminder Timeline</label>
        <div className="relative">
          <div className="h-2 bg-muted rounded-full w-full" />
          <div className="absolute top-0 left-0 h-2 bg-primary rounded-full" style={{ width: "100%" }} />
          {nudges
            .filter((n) => n.trigger === "attainment_reached" && n.attainmentPercent > 0)
            .map((nudge) => (
              <div
                key={nudge.id}
                className="absolute -top-1 w-4 h-4 rounded-full bg-card border-2 border-primary"
                style={{ left: `${Math.min(nudge.attainmentPercent, 100)}%`, transform: "translateX(-50%)" }}
              >
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap">
                  {nudge.attainmentPercent}%
                </span>
              </div>
            ))}
        </div>
        <div className="flex justify-between mt-6 text-[10px] text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
          <span>150%</span>
        </div>
      </Card>

      {/* Reminder Rules */}
      <div className="space-y-2">
        {nudges.map((nudge) => (
          <Card key={nudge.id} className="p-3">
            <div className="flex items-start gap-3">
              <Switch
                checked={nudge.enabled}
                onCheckedChange={(checked) => updateNudge(nudge.id, { enabled: checked })}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px]", typeColors[nudge.type])}>
                    {typeLabels[nudge.type]}
                  </Badge>
                  {nudge.trigger === "attainment_reached" && nudge.attainmentPercent > 0 && (
                    <span className="text-xs text-muted-foreground">
                      At {nudge.attainmentPercent}% attainment
                    </span>
                  )}
                  {nudge.trigger === "no_progress" && (
                    <span className="text-xs text-muted-foreground">No progress detected</span>
                  )}
                </div>
                <Input
                  value={nudge.message}
                  onChange={(e) => updateNudge(nudge.id, { message: e.target.value })}
                  className={cn("text-xs", !nudge.enabled && "opacity-50")}
                  disabled={!nudge.enabled}
                />
                <div className="flex items-center gap-2">
                  <select
                    value={nudge.type}
                    onChange={(e) => updateNudge(nudge.id, { type: e.target.value as NudgeRule["type"] })}
                    className="h-6 rounded border border-input bg-background px-1.5 text-[10px]"
                  >
                    <option value="positive">Positive</option>
                    <option value="push">Push</option>
                    <option value="reminder">Reminder</option>
                  </select>
                  {nudge.trigger === "attainment_reached" && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">at</span>
                      <Input
                        type="number"
                        value={nudge.attainmentPercent}
                        onChange={(e) => updateNudge(nudge.id, { attainmentPercent: parseInt(e.target.value) })}
                        className="w-14 h-6 text-[10px]"
                      />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                  )}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeNudge(nudge.id)}>
                <Trash2 size={12} className="text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Button size="sm" variant="outline" className="text-xs gap-1" onClick={addNudge}>
        <Plus size={12} /> Add Reminder Rule
      </Button>
    </div>
  );
}
