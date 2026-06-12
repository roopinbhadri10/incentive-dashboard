import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Users, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recommendedTemplates, type RecommendedTemplate } from "@/data/mockData";

interface RecommendedPageProps {
  onSelectTemplate: (template: RecommendedTemplate) => void;
  onBack?: () => void;
}

const categoryColors: Record<string, string> = {
  Sales: "bg-[hsl(var(--badge-orange-bg))] text-[hsl(var(--badge-orange-text))] border-[hsl(var(--badge-orange-text))]/20",
  Launch: "bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] border-[hsl(var(--info))]/20",
  Distribution: "bg-[hsl(var(--badge-green-bg))] text-[hsl(var(--badge-green-text))] border-[hsl(var(--badge-green-text))]/20",
  Seasonal: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  Visibility: "bg-[hsl(var(--primary))]/10 text-primary border-primary/20",
};

export function RecommendedPage({ onSelectTemplate }: RecommendedPageProps) {
  const sorted = [...recommendedTemplates].sort((a, b) => b.avgAttainment - a.avgAttainment);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="bg-card rounded-xl mx-4 mt-4 mb-4 p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-1 h-[26px] bg-primary rounded-full" />
            <div>
              <h1 className="text-[22px] font-semibold text-foreground">Recommended Templates</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top-performing incentive structures ranked by historical success
              </p>
            </div>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {sorted.map((template, index) => (
              <Card
                key={template.id}
                className="p-4 hover:shadow-md transition-shadow border border-border group"
              >
                <div className="flex items-start gap-3">
                  {/* Rank */}
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                    #{index + 1}
                  </div>

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
                    {template.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{template.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] rounded-full px-2 ${categoryColors[template.category] || "bg-muted text-muted-foreground"}`}
                      >
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>

                    {/* KPIs */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {template.prefilledConfig.kpis.map((kpi) => (
                        <span key={kpi} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {kpi}
                        </span>
                      ))}
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={12} className="text-[hsl(var(--success))]" />
                        <span className="text-[11px] font-semibold text-foreground">{template.avgAttainment}%</span>
                        <span className="text-[10px] text-muted-foreground">avg attainment</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users size={12} className="text-primary" />
                        <span className="text-[11px] font-semibold text-foreground">{template.timesUsed}x</span>
                        <span className="text-[10px] text-muted-foreground">used</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 size={12} className="text-[hsl(var(--info))]" />
                        <span className="text-[11px] font-semibold text-foreground">{template.avgROI}</span>
                        <span className="text-[10px] text-muted-foreground">avg ROI</span>
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <Button
                    size="sm"
                    className="text-xs gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onSelectTemplate(template)}
                  >
                    Use template <ArrowRight size={12} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
