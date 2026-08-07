import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { stateShapes, VIEW_W, VIEW_H } from "@/lib/indiaGeo";
import type { StateStats } from "@/lib/repAnalytics";

export type MapMetric = "attainment" | "payout" | "users" | "coverage";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/** Teal ramp for the choropleth — 5 steps, light to dark. */
const RAMP = ["#E4F3F0", "#B6E2DA", "#7FCcbf", "#3EB39F", "#0F8A76"];
const EMPTY = "#F2F4F5";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function metricValue(s: StateStats, metric: MapMetric): number {
  switch (metric) {
    case "attainment":
      return s.attainment;
    case "payout":
      return s.payout;
    case "users":
      return s.users;
    case "coverage":
      return s.users ? Math.round((s.earning / s.users) * 100) : 0;
  }
}

export function metricLabel(metric: MapMetric): string {
  return {
    attainment: "Average attainment",
    payout: "Payout to date",
    users: "Users enrolled",
    coverage: "Share of users earning",
  }[metric];
}

interface Props {
  stats: StateStats[];
  metric: MapMetric;
  selected: string | null;
  onSelect: (state: string | null) => void;
  formatValue: (v: number) => string;
}

export function IndiaMapView({ stats, metric, selected, onSelect, formatValue }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const moved = useRef(false);

  const byState = useMemo(() => new Map(stats.map((s) => [s.state, s])), [stats]);

  // Quintile breaks so the ramp always uses its full range.
  const breaks = useMemo(() => {
    const vals = stats.map((s) => metricValue(s, metric)).sort((a, b) => a - b);
    if (!vals.length) return [0, 0, 0, 0];
    return [0.2, 0.4, 0.6, 0.8].map((p) => vals[Math.floor(p * (vals.length - 1))]);
  }, [stats, metric]);

  const colourFor = useCallback(
    (name: string) => {
      const s = byState.get(name);
      if (!s) return EMPTY;
      const v = metricValue(s, metric);
      let i = 0;
      while (i < breaks.length && v > breaks[i]) i++;
      return RAMP[i];
    },
    [byState, breaks, metric],
  );

  // Wheel zoom anchored at the cursor. Native non-passive listener — React's
  // onWheel is passive, so preventDefault there is ignored.
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const { zoom: z, offset: o } = stateRef.current;
      const next = clamp(z * Math.exp(-dy * 0.0018), MIN_ZOOM, MAX_ZOOM);
      if (next === z) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / z;
      setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setZoom((z) => {
      const next = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
      const k = next / z;
      setOffset((o) => ({ x: cx - (cx - o.x) * k, y: cy - (cy - o.y) * k }));
      return next;
    });
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        className="relative rounded-xl border border-border bg-[#FAFBFB] overflow-hidden select-none"
        style={{ touchAction: "none", cursor: drag.current ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
          setOffset({ x: drag.current.ox + dx, y: drag.current.oy + dy });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
          setHover(null);
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-[560px]"
          role="img"
          aria-label="Incentive performance by Indian state"
        >
          <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
            {stateShapes.map((s) => {
              const data = byState.get(s.name);
              const isSel = selected === s.name;
              const isHover = hover?.name === s.name;
              return (
                <g
                  key={s.name}
                  onMouseEnter={(e) => {
                    const r = wrapRef.current?.getBoundingClientRect();
                    if (r) setHover({ name: s.name, x: e.clientX - r.left, y: e.clientY - r.top });
                  }}
                  onMouseMove={(e) => {
                    const r = wrapRef.current?.getBoundingClientRect();
                    if (r) setHover({ name: s.name, x: e.clientX - r.left, y: e.clientY - r.top });
                  }}
                  onClick={() => {
                    if (moved.current) return;
                    onSelect(isSel ? null : data ? s.name : null);
                  }}
                  style={{ cursor: data ? "pointer" : "default" }}
                >
                  <path
                    d={s.fill}
                    fill={colourFor(s.name)}
                    fillOpacity={isHover || isSel ? 1 : 0.92}
                    stroke="none"
                  />
                  <path
                    d={s.outline}
                    fill="none"
                    stroke={isSel ? "#0B5F52" : isHover ? "#0F8A76" : "#FFFFFF"}
                    strokeWidth={(isSel ? 2.2 : isHover ? 1.8 : 0.9) / zoom}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}

            {/* Labels only once zoomed in enough to be readable */}
            {zoom >= 2.2 &&
              stateShapes.map((s) =>
                byState.has(s.name) ? (
                  <text
                    key={`l-${s.name}`}
                    x={s.cx}
                    y={s.cy}
                    textAnchor="middle"
                    className="pointer-events-none fill-foreground/70"
                    style={{ fontSize: 9 / zoom, fontWeight: 500 }}
                  >
                    {s.name}
                  </text>
                ) : null,
              )}
          </g>
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col rounded-lg border border-border bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => zoomBy(1.4)}
            aria-label="Zoom in"
            className="h-8 w-8 grid place-items-center hover:bg-muted/50 transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => zoomBy(1 / 1.4)}
            aria-label="Zoom out"
            className="h-8 w-8 grid place-items-center border-t border-border hover:bg-muted/50 transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={reset}
            aria-label="Reset view"
            className="h-8 w-8 grid place-items-center border-t border-border hover:bg-muted/50 transition-colors"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-white/95 backdrop-blur px-3 py-2 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {metricLabel(metric)}
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            {RAMP.map((c) => (
              <span key={c} className="h-2.5 w-7 rounded-sm" style={{ background: c }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        {/* Tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-border bg-white shadow-md px-3 py-2 min-w-[168px]"
            style={{
              left: clamp(hover.x + 14, 8, (wrapRef.current?.clientWidth ?? 600) - 190),
              top: clamp(hover.y + 14, 8, 500),
            }}
          >
            <p className="text-[12px] font-semibold text-foreground">{hover.name}</p>
            {byState.has(hover.name) ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  {byState.get(hover.name)!.region} region ·{" "}
                  {byState.get(hover.name)!.users} users
                </p>
                <p className="mt-1 text-[13px] font-semibold tabular-nums text-foreground">
                  {formatValue(metricValue(byState.get(hover.name)!, metric))}
                </p>
                <p className="text-[10px] text-muted-foreground">Click to drill in</p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">No programmes running</p>
            )}
          </div>
        )}
      </div>

      <p className={cn("mt-2 text-[11px] text-muted-foreground")}>
        Scroll to zoom, drag to pan, click a state to drill in. Grey states have no active coverage.
      </p>
    </div>
  );
}
