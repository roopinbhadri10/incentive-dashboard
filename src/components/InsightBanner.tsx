import { useState, useEffect, useMemo } from "react";
import { X, TrendingUp, Copy, Eye, AlertTriangle, Target, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IncentiveProgram } from "@/data/mockData";

interface ComputedInsight {
  title: string;
  body: string;
  evidence: string;
  cta: string;
  ctaAction: "view" | "clone" | "create";
  ctaProgramId?: string;
  gradientClass: string;
  glowColor: string;
  iconBg: string;
  icon: React.ReactNode;
}

const palettes = [
  { gradientClass: "gradient-banner-purple", glowColor: "#A58FF4", iconBg: "#5F45C7" },
  { gradientClass: "gradient-banner-blue", glowColor: "#94B1FF", iconBg: "#6492FF" },
  { gradientClass: "gradient-banner-orange", glowColor: "#FFB87A", iconBg: "#D26320" },
];

const icons = [
  <AlertTriangle size={18} className="text-white" />,
  <Copy size={18} className="text-white" />,
  <Target size={18} className="text-white" />,
  <TrendingUp size={18} className="text-white" />,
  <MapPin size={18} className="text-white" />,
];

function generateInsights(programs: IncentiveProgram[]): ComputedInsight[] {
  if (!programs.length) return [];
  const insights: Omit<ComputedInsight, "gradientClass" | "glowColor" | "iconBg">[] = [];

  const parseRate = (p: IncentiveProgram) => parseFloat(p.attainmentRate);

  // 1. Underperforming program alert — lowest attainment program
  const withRates = programs.map(p => ({ p, rate: parseRate(p) })).filter(x => !isNaN(x.rate));
  if (withRates.length) {
    const worst = withRates.reduce((a, b) => a.rate < b.rate ? a : b);
    if (worst.rate < 60) {
      insights.push({
        title: "Needs attention",
        body: `${worst.p.name} is at ${worst.p.attainmentRate} attainment — review targets or send a nudge to ${worst.p.coverageCount}`,
        evidence: `Lowest performing among ${programs.length} programs`,
        cta: "View Program",
        ctaAction: "view",
        ctaProgramId: worst.p.name,
        icon: icons[0],
      });
    }
  }

  // 2. Clone top performer
  if (withRates.length >= 2) {
    const best = withRates.reduce((a, b) => a.rate > b.rate ? a : b);
    if (best.rate >= 75) {
      insights.push({
        title: "Top performer",
        body: `${best.p.name} hit ${best.p.attainmentRate} attainment with ${best.p.coverageCount} — clone it for your next cycle`,
        evidence: `Highest attainment across ${programs.length} programs`,
        cta: "Clone Program",
        ctaAction: "clone",
        ctaProgramId: best.p.name,
        icon: icons[1],
      });
    }
  }

  // 3. KPI target too aggressive — find a KPI that underperforms across multiple programs
  const kpiScores: Record<string, { total: number; count: number; hitCount: number }> = {};
  programs.forEach(p =>
    p.kpis.forEach(k => {
      if (!kpiScores[k.name]) kpiScores[k.name] = { total: 0, count: 0, hitCount: 0 };
      kpiScores[k.name].total += k.attainment;
      kpiScores[k.name].count++;
      if (k.attainment >= 80) kpiScores[k.name].hitCount++;
    })
  );
  let worstKpi = "";
  let worstKpiAvg = 100;
  let worstKpiCount = 0;
  let worstKpiHits = 0;
  Object.entries(kpiScores).forEach(([name, data]) => {
    if (data.count >= 3) {
      const avg = Math.round(data.total / data.count);
      if (avg < worstKpiAvg) {
        worstKpi = name;
        worstKpiAvg = avg;
        worstKpiCount = data.count;
        worstKpiHits = data.hitCount;
      }
    }
  });
  if (worstKpi && worstKpiAvg < 65) {
    insights.push({
      title: "Target too aggressive",
      body: `${worstKpi} hit target in ${worstKpiHits} of ${worstKpiCount} programs (avg ${worstKpiAvg}%) — lower the threshold or re-weight it`,
      evidence: `Consistently underperforming KPI across your programs`,
      cta: "Create Program",
      ctaAction: "create",
      icon: icons[2],
    });
  }

  // 4. Budget at risk — program with low budget usage vs high attainment gap
  const budgetPrograms = programs.filter(p => p.allocatedBudget);
  if (budgetPrograms.length) {
    const lowAttainment = budgetPrograms
      .map(p => ({ p, rate: parseRate(p) }))
      .filter(x => !isNaN(x.rate) && x.rate < 50);
    if (lowAttainment.length) {
      const riskiest = lowAttainment.reduce((a, b) => a.rate < b.rate ? a : b);
      insights.push({
        title: "Budget at risk",
        body: `${riskiest.p.name} has ${riskiest.p.allocatedBudget} allocated but only ${riskiest.p.attainmentRate} attainment — consider adjusting targets`,
        evidence: `${riskiest.p.coverageCount} may not earn payouts at current pace`,
        cta: "Review Program",
        ctaAction: "view",
        ctaProgramId: riskiest.p.name,
        icon: icons[3],
      });
    }
  }

  // 5. Regional opportunity — region with highest attainment but fewest programs
  const byRegion: Record<string, { rates: number[]; count: number }> = {};
  programs.forEach(p => {
    const rate = parseRate(p);
    if (!isNaN(rate)) {
      if (!byRegion[p.region]) byRegion[p.region] = { rates: [], count: 0 };
      byRegion[p.region].rates.push(rate);
      byRegion[p.region].count++;
    }
  });
  const regionEntries = Object.entries(byRegion).filter(([, v]) => v.rates.length >= 1);
  if (regionEntries.length >= 2) {
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    regionEntries.sort((a, b) => avg(b[1].rates) - avg(a[1].rates));
    const topRegion = regionEntries[0];
    const leastPrograms = regionEntries.reduce((a, b) => a[1].count < b[1].count ? a : b);
    // If the top-performing region also has fewer programs, that's a clear opportunity
    if (topRegion[0] === leastPrograms[0] || leastPrograms[1].count < regionEntries[0][1].count) {
      const target = topRegion[0] === leastPrograms[0] ? topRegion : leastPrograms;
      const targetAvg = avg(target[1].rates);
      if (targetAvg >= 70) {
        insights.push({
          title: "Regional opportunity",
          body: `${target[0]} region avg ${targetAvg}% attainment with only ${target[1].count} program${target[1].count > 1 ? 's' : ''} — expand coverage there`,
          evidence: `Other regions have up to ${Math.max(...regionEntries.map(e => e[1].count))} programs`,
          cta: "Create Program",
          ctaAction: "create",
          icon: icons[4],
        });
      }
    }
  }

  // Take top 3 and assign palettes
  return insights.slice(0, 3).map((ins, i) => ({
    ...ins,
    ...palettes[i % palettes.length],
  }));
}

interface InsightBannerProps {
  onCreateProgram?: () => void;
  onViewProgram?: (programId: string) => void;
  onCloneProgram?: (programId: string) => void;
  programs?: IncentiveProgram[];
}

export function InsightBanner({ onCreateProgram, onViewProgram, onCloneProgram, programs = [] }: InsightBannerProps) {
  const slides = useMemo(() => generateInsights(programs), [programs]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [isAnimating, setIsAnimating] = useState(false);

  const goToSlide = (index: number) => {
    if (index === activeSlide || isAnimating) return;
    setDirection(index > activeSlide ? "left" : "right");
    setIsAnimating(true);
    setTimeout(() => {
      setActiveSlide(index);
      setTimeout(() => setIsAnimating(false), 50);
    }, 300);
  };

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setDirection("left");
      setIsAnimating(true);
      setTimeout(() => {
        setActiveSlide((prev) => (prev + 1) % slides.length);
        setTimeout(() => setIsAnimating(false), 50);
      }, 300);
    }, 10000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Reset activeSlide when slides array changes
  useEffect(() => {
    if (activeSlide >= slides.length) {
      setActiveSlide(0);
    }
  }, [slides.length, activeSlide]);

  const safeIndex = slides.length ? activeSlide % slides.length : 0;

  if (dismissed || !slides.length) return null;

  const slide = slides[safeIndex];

  const handleCta = () => {
    if (slide.ctaAction === "view" && slide.ctaProgramId && onViewProgram) {
      onViewProgram(slide.ctaProgramId);
    } else if (slide.ctaAction === "clone" && slide.ctaProgramId && onCloneProgram) {
      onCloneProgram(slide.ctaProgramId);
    } else if (onCreateProgram) {
      onCreateProgram();
    }
  };

  const animClass = isAnimating
    ? direction === "left"
      ? "translate-x-[-20px] opacity-0"
      : "translate-x-[20px] opacity-0"
    : "translate-x-0 opacity-100";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative w-full h-[114px] rounded-[14px] overflow-hidden flex items-center transition-all duration-500",
          slide.gradientClass
        )}
      >
        {/* Glow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[35px] w-[190px] h-[190px] rounded-full blur-[85px] opacity-40 transition-all duration-500"
          style={{ background: slide.glowColor }}
        />

        {/* Sliding content */}
        <div className={cn("flex items-center flex-1 min-w-0 transition-all duration-300 ease-in-out", animClass)}>
          {/* Icon */}
          <div className="relative ml-6 shrink-0">
            <div
              className="w-[39px] h-[39px] rounded-full flex items-center justify-center border border-white/10"
              style={{ background: slide.iconBg, boxShadow: `0 0 6px ${slide.glowColor}` }}
            >
              {slide.icon}
            </div>
            <div className="absolute -inset-3 border border-white/10 rounded-full" />
            <div className="absolute -inset-5 border border-white/5 rounded-full" />
          </div>

          {/* Text */}
          <div className="ml-10 flex flex-col gap-1 min-w-0 flex-1">
            <p className="text-xs font-semibold text-white/70 leading-none uppercase tracking-wide">
              {slide.title}
            </p>
            <p className="text-sm font-bold text-white leading-snug pr-4">
              {slide.body}
            </p>
            <p className="text-[11px] text-white/50 leading-none">
              {slide.evidence}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 mr-[30px] shrink-0">
          <button
            onClick={handleCta}
            className="w-[140px] h-[38px] rounded-lg font-semibold text-sm flex items-center justify-center transition-colors bg-white/20 text-white hover:bg-white/30"
          >
            {slide.cta}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/90 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="flex items-center gap-[6px]">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                i === safeIndex ? "bg-[#6B7B92]" : "bg-[#E4E4E4]"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
