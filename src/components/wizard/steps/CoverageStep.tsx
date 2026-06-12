import { useState, useEffect } from "react";
import { fetchChannelNames } from "@/lib/saleshubApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { mockSalesReps, regions } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { FileUp, Filter, Search, Sparkles, Upload, Users, X, Loader2, Zap, TrendingUp, Target, MessageSquare } from "lucide-react";

type CoverageMode = "select" | "custom" | "import";

const aiSuggestions = [
  { label: "Top performers in North who missed cross-sell targets", icon: <TrendingUp size={14} />, reps: 12 },
  { label: "Reps with >40 outlets but <₹50K avg order value", icon: <Target size={14} />, reps: 8 },
  { label: "South region reps with declining visit frequency", icon: <Zap size={14} />, reps: 15 },
];

function CustomCoverageBuilder({ channels }: { channels: string[] }) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    description: string;
    filters: { label: string; value: string }[];
    repCount: number;
    outletCount: number;
    insight: string;
  } | null>(null);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setGeneratedResult({
        description: `AI-built group based on: "${prompt}"`,
        filters: [
          { label: "Region", value: "North, West" },
          { label: "Performance Tier", value: "Mid-tier (40-70% attainment)" },
          { label: "Channel", value: "General Trade" },
          { label: "Min Outlets", value: "30+" },
        ],
        repCount: 23,
        outletCount: 847,
        insight: "This segment has historically shown 31% higher response to volume-based incentives. Consider pairing with cross-sell KPIs for maximum impact.",
      });
      setIsGenerating(false);
    }, 1800);
  };

  return (
    <div className="space-y-4">
      {/* AI Prompt Input */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare size={14} className="text-primary" />
          </div>
          <p className="text-sm font-semibold">Describe your coverage in plain English</p>
        </div>
        <Textarea
          placeholder='e.g. "Sales reps in North & West who have more than 30 outlets and are currently below 60% attainment on volume targets"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="text-xs min-h-[72px] resize-none"
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            AI analyzes your master data, historical performance & SFA data
          </p>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleGenerate} disabled={!prompt.trim() || isGenerating}>
            {isGenerating ? (
              <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
            ) : (
              <><Sparkles size={14} /> Build with AI</>
            )}
          </Button>
        </div>
      </Card>

      {/* Quick AI Suggestions */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Sparkles size={12} className="text-primary" /> AI-suggested groups based on your data
        </p>
        <div className="grid grid-cols-1 gap-2">
          {aiSuggestions.map((s, i) => (
            <Card key={i} className="p-3 cursor-pointer hover:border-primary/40 transition-all group" onClick={() => setPrompt(s.label)}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">{s.icon}</div>
                <div className="flex-1">
                  <p className="text-xs font-medium group-hover:text-primary transition-colors">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.reps} reps match this criteria</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">Use this</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Manual Filters */}
      <Card className="p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Or refine with manual filters</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Region", options: ["North", "South", "East", "West"] },
            { name: "Territory", options: ["Delhi NCR", "Mumbai Metro", "Bangalore Urban", "Punjab"] },
            { name: "Channel", options: channels },
            { name: "Performance Tier", options: ["Top 20%", "Mid-tier (40-70%)", "Bottom 30%"] },
          ].map((filter) => (
            <div key={filter.name}>
              <label className="text-xs text-muted-foreground mb-1 block">{filter.name}</label>
              <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
                <option>Select {filter.name.toLowerCase()}...</option>
                {filter.options.map((opt) => <option key={opt}>{opt}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Generated Result */}
      {generatedResult && (
        <Card className="p-4 space-y-3 border-primary/30 bg-primary/[0.02]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <p className="text-sm font-semibold">AI-Generated Group</p>
            <Badge className="text-[10px] ml-auto">Ready to use</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{generatedResult.description}</p>
          <div className="flex flex-wrap gap-2">
            {generatedResult.filters.map((f) => (
              <Badge key={f.label} variant="secondary" className="text-[10px] gap-1">
                {f.label}: <span className="font-semibold">{f.value}</span>
              </Badge>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-bold text-foreground">{generatedResult.repCount}</p>
              <p className="text-[10px] text-muted-foreground">Sales Reps</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-bold text-foreground">{generatedResult.outletCount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total Outlets</p>
            </div>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 flex items-start gap-2">
            <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/80">{generatedResult.insight}</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="text-xs gap-1.5 flex-1"><Users size={14} /> Apply this selection</Button>
            <Button size="sm" variant="outline" className="text-xs">Refine</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export function CoverageStep() {
  const [mode, setMode] = useState<CoverageMode>("select");
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["North"]);
  const [selectedReps, setSelectedReps] = useState<string[]>(["sr1", "sr5"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [channels, setChannels] = useState<string[]>(["General Trade", "Modern Trade", "Horeca", "E-Commerce"]);

  useEffect(() => {
    fetchChannelNames()
      .then((names) => { if (names.length > 0) setChannels(names); })
      .catch(() => { /* keep defaults */ });
  }, []);

  const filteredReps = mockSalesReps.filter(
    (rep) =>
      (selectedRegions.length === 0 || selectedRegions.includes(rep.region)) &&
      (searchQuery === "" || rep.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const toggleRep = (id: string) => {
    setSelectedReps((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* AI Suggestion Banner */}
      <div className="gradient-banner rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Sparkles size={18} className="text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-foreground">AI Recommendation</p>
            <p className="text-xs text-primary-foreground/80">
              Based on historical data, <strong>North Region reps</strong> have 23% higher incentive response rates. We recommend targeting them first.
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" className="shrink-0 text-xs">Apply suggestion</Button>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-3">
        {[
          { id: "select" as CoverageMode, label: "Select from list", icon: <Users size={16} />, desc: "Choose from existing sales reps" },
          { id: "custom" as CoverageMode, label: "Build custom list", icon: <Filter size={16} />, desc: "AI-powered segment builder" },
          { id: "import" as CoverageMode, label: "Upload / Import", icon: <Upload size={16} />, desc: "Import CSV or Excel file" },
        ].map((m) => (
          <Card
            key={m.id}
            className={cn(
              "flex-1 p-3 cursor-pointer transition-all border-2",
              mode === m.id ? "border-primary bg-sidebar-accent" : "border-transparent hover:border-border"
            )}
            onClick={() => setMode(m.id)}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-primary">{m.icon}</span>
              <span className="text-sm font-medium">{m.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </Card>
        ))}
      </div>

      {mode === "select" && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Regions:</span>
            {regions.map((region) => (
              <Badge
                key={region}
                variant={selectedRegions.includes(region) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleRegion(region)}
              >
                {region}
                {selectedRegions.includes(region) && <X size={10} className="ml-1" />}
              </Badge>
            ))}
            <div className="ml-auto relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search reps..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-7 text-xs w-48" />
            </div>
          </div>
          <Card className="divide-y divide-border">
            <div className="px-4 py-2 flex items-center gap-2">
              <Checkbox
                checked={filteredReps.every((r) => selectedReps.includes(r.id))}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedReps(filteredReps.map((r) => r.id));
                  else setSelectedReps([]);
                }}
              />
              <span className="text-xs font-medium text-muted-foreground">Select all {filteredReps.length} reps</span>
              <Badge variant="secondary" className="ml-auto text-xs">{selectedReps.length} selected</Badge>
            </div>
            {filteredReps.map((rep) => (
              <div key={rep.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                <Checkbox checked={selectedReps.includes(rep.id)} onCheckedChange={() => toggleRep(rep.id)} />
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                  {rep.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{rep.name}</p>
                  <p className="text-xs text-muted-foreground">{rep.territory}</p>
                </div>
                <Badge variant="outline" className="text-xs">{rep.region}</Badge>
                <span className="text-xs text-muted-foreground">{rep.outlets} outlets</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {mode === "import" && (
        <Card className="p-8 text-center border-2 border-dashed">
          <FileUp size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Drop your file here or click to upload</p>
          <p className="text-xs text-muted-foreground mb-4">Supports CSV, XLSX formats. Max 10MB.</p>
          <Button size="sm">Browse Files</Button>
        </Card>
      )}

      {mode === "custom" && <CustomCoverageBuilder channels={channels} />}
    </div>
  );
}
