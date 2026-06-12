import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTour } from "./TourContext";

const PADDING = 8;
const TOOLTIP_GAP = 14;
const TOOLTIP_W = 340;
const TOOLTIP_H_EST = 200;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TourSpotlight() {
  const { isActive, currentStep, stepIndex, totalSteps, next, prev, skip } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Locate target element with retry (handles route transitions)
  useLayoutEffect(() => {
    if (!isActive || !currentStep) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(currentStep.selector);
      if (el) {
        // Scroll into view if needed
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        // Give it a frame to settle
        requestAnimationFrame(() => {
          if (!cancelled) setRect(getRect(el));
        });
      } else if (attempts < 20) {
        attempts += 1;
        setTimeout(find, 100);
      } else {
        // Fallback: center of screen
        setRect(null);
      }
    };
    find();
    return () => {
      cancelled = true;
    };
  }, [isActive, currentStep, retryCount]);

  // Re-measure on resize / scroll
  useEffect(() => {
    if (!isActive || !currentStep) return;
    const onChange = () => {
      const el = document.querySelector(currentStep.selector);
      if (el) setRect(getRect(el));
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [isActive, currentStep]);

  // Keyboard: ESC = skip, → = next, ← = prev
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, next, prev, skip]);

  // Force a re-find when the spotlight is open and the user navigates back
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setRetryCount((c) => c + 1), 1500);
    return () => clearInterval(t);
  }, [isActive]);

  if (!isActive || !currentStep) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Compute spotlight + tooltip position
  const spot = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  // Tooltip placement
  let tipTop = vh / 2 - TOOLTIP_H_EST / 2;
  let tipLeft = vw / 2 - TOOLTIP_W / 2;
  let placement = currentStep.placement ?? "auto";

  if (spot) {
    if (placement === "auto") {
      const spaceRight = vw - (spot.left + spot.width);
      const spaceBottom = vh - (spot.top + spot.height);
      const spaceLeft = spot.left;
      const spaceTop = spot.top;
      const max = Math.max(spaceRight, spaceBottom, spaceLeft, spaceTop);
      placement =
        max === spaceRight ? "right" : max === spaceBottom ? "bottom" : max === spaceLeft ? "left" : "top";
    }

    if (placement === "right") {
      tipLeft = spot.left + spot.width + TOOLTIP_GAP;
      tipTop = spot.top + spot.height / 2 - TOOLTIP_H_EST / 2;
    } else if (placement === "left") {
      tipLeft = spot.left - TOOLTIP_W - TOOLTIP_GAP;
      tipTop = spot.top + spot.height / 2 - TOOLTIP_H_EST / 2;
    } else if (placement === "bottom") {
      tipLeft = spot.left + spot.width / 2 - TOOLTIP_W / 2;
      tipTop = spot.top + spot.height + TOOLTIP_GAP;
    } else if (placement === "top") {
      tipLeft = spot.left + spot.width / 2 - TOOLTIP_W / 2;
      tipTop = spot.top - TOOLTIP_H_EST - TOOLTIP_GAP;
    }
  }

  // Clamp into viewport
  tipLeft = Math.max(12, Math.min(vw - TOOLTIP_W - 12, tipLeft));
  tipTop = Math.max(12, Math.min(vh - TOOLTIP_H_EST - 12, tipTop));

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dim overlay using SVG mask so the spotlight area is fully transparent */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={skip}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.left}
                y={spot.top}
                width={spot.width}
                height={spot.height}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.65)" mask="url(#tour-mask)" />
      </svg>

      {/* Highlight ring around the spot */}
      {spot && (
        <div
          className="absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background/0 pointer-events-none transition-all duration-300 animate-pulse-slow"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={cn(
          "absolute pointer-events-auto bg-card border border-border rounded-xl shadow-2xl p-5 transition-all duration-200",
          "animate-in fade-in zoom-in-95",
        )}
        style={{ top: tipTop, left: tipLeft, width: TOOLTIP_W }}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Info size={14} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>
          <button
            onClick={skip}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>

        <h3 className="text-base font-semibold text-foreground mb-2">{currentStep.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{currentStep.body}</p>

        {/* Progress dots */}
        <div className="flex items-center gap-1 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i === stepIndex ? "w-6 bg-primary" : i < stepIndex ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={skip} className="text-muted-foreground text-xs h-8">
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={prev} className="h-8 text-xs">
                <ChevronLeft size={14} className="mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={next} className="h-8 text-xs">
              {isLast ? "Got it" : "Next"}
              {!isLast && <ChevronRight size={14} className="ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
