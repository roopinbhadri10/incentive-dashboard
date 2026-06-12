import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProgramKPI } from "@/data/mockData";

const DONUT_COLORS = [
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(210, 60%, 55%)",
  "hsl(280, 50%, 55%)",
  "hsl(30, 70%, 55%)",
  "hsl(350, 55%, 55%)",
];

interface KpiDonutChartProps {
  kpis: ProgramKPI[];
}

export function KpiDonutChart({ kpis }: KpiDonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const size = 140;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build segments
  let cumulativePercent = 0;
  const segments = kpis.map((kpi, idx) => {
    const percent = kpi.weight / 100;
    const dashLength = percent * circumference;
    const gapLength = circumference - dashLength;
    const offset = -cumulativePercent * circumference + circumference * 0.25;
    cumulativePercent += percent;
    return {
      kpi,
      color: DONUT_COLORS[idx % DONUT_COLORS.length],
      dashArray: `${dashLength} ${gapLength}`,
      dashOffset: offset,
    };
  });

  // Overall weighted attainment
  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
  const weightedAttainment = totalWeight > 0
    ? Math.round(kpis.reduce((s, k) => s + k.attainment * k.weight, 0) / totalWeight)
    : 0;

  const hoveredKpi = hoveredIdx !== null ? kpis[hoveredIdx] : null;

  return (
    <div className="flex items-start gap-6">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {segments.map(({ kpi, color, dashArray, dashOffset }, idx) => (
            <circle
              key={kpi.name}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              pointerEvents="stroke"
              opacity={hoveredIdx !== null && hoveredIdx !== idx ? 0.4 : 1}
              className="cursor-pointer transition-opacity duration-150"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-foreground">{weightedAttainment}%</span>
          <span className="text-[9px] text-muted-foreground">Avg. Attainment</span>
        </div>

        {/* Tooltip */}
        {hoveredKpi && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full z-50 bg-popover border rounded-md shadow-md px-3 py-2 text-xs space-y-0.5 whitespace-nowrap pointer-events-none">
            <p className="font-semibold">{hoveredKpi.name}</p>
            <p className="text-muted-foreground">Target: {hoveredKpi.target}</p>
            <p className="text-muted-foreground">Weight: {hoveredKpi.weight}%</p>
            <p className={cn(
              "font-bold",
              hoveredKpi.attainment >= 80 ? "text-[hsl(var(--success))]" : hoveredKpi.attainment >= 60 ? "text-[hsl(var(--warning))]" : "text-destructive"
            )}>
              Attainment: {hoveredKpi.attainment}%
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 pt-1">
        {kpis.map((kpi, idx) => (
          <div
            key={kpi.name}
            className={cn(
              "flex items-center gap-2 text-[11px] cursor-pointer rounded px-1 -mx-1 transition-colors",
              hoveredIdx === idx && "bg-muted"
            )}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
            />
            <span className="text-muted-foreground">{kpi.name}</span>
            <span className="font-bold text-foreground ml-auto">{kpi.attainment}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
