import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, LayoutTemplate, FileSpreadsheet, Plus, ArrowLeft, ArrowRight, TrendingUp, Target, CheckCircle2, AlertTriangle, XCircle, ChevronDown } from "lucide-react";
import { mockLivePlans, programTemplates, type IncentivePlan, type ProgramTemplate } from "@/data/mockData";
import { cn } from "@/lib/utils";

export type CreatePath = "ai" | "clone" | "template" | "blank";
/** Seed object handed back with a path: a template (template tab) or a plan (clone tab). */
export type CreatePathData = ProgramTemplate | IncentivePlan;

interface CreateProgramHubProps {
  onSelectPath: (path: CreatePath, data?: CreatePathData) => void;
  onBack: () => void;
  initialTab?: "clone" | "template" | "excel";
  initialClonePlanId?: string;
}

export function CreateProgramHub({ onSelectPath, onBack, initialTab, initialClonePlanId }: CreateProgramHubProps) {
  const [activeTab, setActiveTab] = useState<"clone" | "template" | "excel">(initialTab || "clone");

  const tabs = [
    { id: "clone" as const, label: "Clone & Modify", icon: <Copy size={16} /> },
    { id: "template" as const, label: "Templates", icon: <LayoutTemplate size={16} /> },
    { id: "excel" as const, label: "Excel Import", icon: <FileSpreadsheet size={16} /> },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
            <ArrowLeft size={14} /> Back to Programs
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Create New Incentive Program</h1>
          <p className="text-sm text-muted-foreground">Choose how you'd like to get started</p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-all",
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clone & Modify */}
        {activeTab === "clone" && (
          <CloneTab onSelectPath={onSelectPath} initialExpandedId={initialClonePlanId} />
        )}

        {/* Templates */}
        {activeTab === "template" && (
          <div className="animate-fade-in space-y-4">
            <p className="text-xs text-muted-foreground">Industry-proven templates. Pick one and customize in 2 clicks.</p>
            <div className="grid grid-cols-2 gap-3">
              {programTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => onSelectPath("template", template)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{template.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold">{template.name}</h3>
                        <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{template.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Target size={10} /> {template.prefilledConfig.kpis.length} KPIs</span>
                        <span className="flex items-center gap-1"><TrendingUp size={10} /> Est. ROI {template.prefilledConfig.estimatedROI}</span>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Excel Import */}
        {activeTab === "excel" && (
          <div className="animate-fade-in space-y-4">
            <Card className="p-8 border-dashed border-2 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                <FileSpreadsheet size={28} className="text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Upload your Excel incentive sheet</h3>
                <p className="text-xs text-muted-foreground">We'll parse your existing format and auto-map columns to the wizard fields.</p>
              </div>
              <Button variant="outline" className="text-sm gap-2">
                <FileSpreadsheet size={14} /> Choose Excel File
              </Button>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p>Supports .xlsx, .xls, .csv formats</p>
                <p>We'll detect: reps, KPIs, payout slabs, budget, product SKUs</p>
              </div>
            </Card>
          </div>
        )}

        {/* Blank option always visible at bottom */}
        <div className="pt-2 border-t border-border">
          <button
            onClick={() => onSelectPath("blank")}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={14} /> Or start with a blank program
          </button>
        </div>
      </div>
    </div>
  );
}

const insightConfig = {
  keep: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "Keep" },
  improve: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: "Improve" },
  drop: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Drop" },
};

function CloneTab({ onSelectPath, initialExpandedId }: { onSelectPath: CreateProgramHubProps["onSelectPath"]; initialExpandedId?: string }) {
  const matchedPlan = initialExpandedId ? mockLivePlans.find(p => p.name === initialExpandedId) : null;
  const [expandedId, setExpandedId] = useState<string | null>(matchedPlan?.id || null);

  return (
    <div className="animate-fade-in space-y-3">
      <p className="text-xs text-muted-foreground">Pick a past program. Review what worked, then clone.</p>
      {mockLivePlans.map((plan) => {
        const isExpanded = expandedId === plan.id;
        const headline = plan.aiInsights?.[0];
        return (
          <Card key={plan.id} className={cn("transition-all", isExpanded && "border-primary/30 shadow-md")}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : plan.id)}
              className="w-full p-4 text-left"
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold truncate">{plan.name}</h3>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", plan.status === "live" ? "bg-success/10 text-success" : "bg-info/10 text-info")}>
                      {plan.status}
                    </Badge>
                  </div>
                  {headline && (
                    <p className={cn("text-xs", insightConfig[headline.type].color)}>
                      💡 {headline.text}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className={cn("text-lg font-bold", plan.avgAttainment >= 70 ? "text-success" : "text-warning")}>{plan.avgAttainment}%</p>
                    <p className="text-[10px] text-muted-foreground">Attainment</p>
                  </div>
                  <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                </div>
              </div>
            </button>

            {isExpanded && plan.aiInsights && (
              <div className="px-4 pb-4 space-y-3 animate-fade-in">
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recommendations</p>
                  {plan.aiInsights.map((insight, i) => {
                    const config = insightConfig[insight.type];
                    const Icon = config.icon;
                    return (
                      <div key={i} className={cn("flex items-start gap-2 rounded-md px-3 py-2 text-xs", config.bg)}>
                        <Icon size={14} className={cn("shrink-0 mt-0.5", config.color)} />
                        <span className="text-foreground">{insight.text}</span>
                      </div>
                    );
                  })}
                </div>
                <Button size="sm" className="w-full gap-2 text-xs" onClick={() => onSelectPath("clone", plan)}>
                  <Copy size={12} /> Clone this plan
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
