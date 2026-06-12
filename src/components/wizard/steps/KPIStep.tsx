import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { mockKPIs, type KPI } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Plus, Search, Sparkles, Wand2 } from "lucide-react";

const categoryColors: Record<string, string> = {
  sales: "highlight-green",
  distribution: "highlight-blue",
  visibility: "highlight-yellow",
  compliance: "bg-muted",
  custom: "bg-primary/10",
};

const categoryLabels: Record<string, string> = {
  sales: "Sales",
  distribution: "Distribution",
  visibility: "Visibility",
  compliance: "Compliance",
  custom: "Custom",
};

export function KPIStep() {
  const [selectedKPIs, setSelectedKPIs] = useState<string[]>(["kpi1", "kpi3"]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customKPIName, setCustomKPIName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["all", "sales", "distribution", "visibility", "compliance"];

  const filteredKPIs = mockKPIs.filter(
    (kpi) =>
      (activeCategory === "all" || kpi.category === activeCategory) &&
      (searchQuery === "" || kpi.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleKPI = (id: string) => {
    setSelectedKPIs((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
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
            <p className="text-sm font-semibold text-primary-foreground">AI Insight</p>
            <p className="text-xs text-primary-foreground/80">
              Combining <strong>Revenue Target</strong> + <strong>Numeric Distribution</strong> has shown <strong>34% higher ROI</strong> in your past campaigns.
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" className="text-xs shrink-0">Apply</Button>
      </div>

      {/* Category Filter + Search */}
      <div className="flex items-center gap-2">
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            className="cursor-pointer text-xs capitalize"
            onClick={() => setActiveCategory(cat)}
          >
            {cat === "all" ? "All KPIs" : categoryLabels[cat]}
          </Badge>
        ))}
        <div className="ml-auto relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search KPIs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-7 text-xs w-48" />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredKPIs.map((kpi) => (
          <Card
            key={kpi.id}
            className={cn(
              "p-3 cursor-pointer transition-all border-2",
              selectedKPIs.includes(kpi.id) ? "border-primary bg-sidebar-accent" : "border-transparent hover:border-border"
            )}
            onClick={() => toggleKPI(kpi.id)}
          >
            <div className="flex items-start gap-2">
              <Checkbox checked={selectedKPIs.includes(kpi.id)} className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{kpi.name}</span>
                  {kpi.isAISuggested && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                      <Sparkles size={8} className="mr-0.5" /> AI
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{kpi.description}</p>
                <Badge variant="outline" className={cn("text-[10px] mt-2", categoryColors[kpi.category])}>
                  {categoryLabels[kpi.category]}
                </Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Custom KPI Builder */}
      <Card className="p-4 border-dashed border-2">
        {!showCustomBuilder ? (
          <button
            onClick={() => setShowCustomBuilder(true)}
            className="w-full flex items-center justify-center gap-2 text-sm text-primary font-medium py-2"
          >
            <Plus size={16} /> Build Custom KPI with AI
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-primary" />
              <span className="text-sm font-medium">Custom KPI Builder</span>
            </div>
            <Input
              placeholder="Describe your KPI in plain English, e.g., 'Measure how many new outlets start ordering Fanta this month'"
              value={customKPIName}
              onChange={(e) => setCustomKPIName(e.target.value)}
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" className="text-xs gap-1">
                <Sparkles size={12} /> Generate KPI with AI
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowCustomBuilder(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">{selectedKPIs.length} KPIs selected</Badge>
      </div>
    </div>
  );
}
