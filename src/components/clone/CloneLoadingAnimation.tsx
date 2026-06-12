import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Sparkles, Brain, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { label: "Analyzing program performance data...", icon: Brain },
  { label: "Identifying low-hanging improvements...", icon: Sparkles },
  { label: "Optimizing KPIs & payout tiers...", icon: Zap },
  { label: "Building your improved program...", icon: CheckCircle2 },
];

interface CloneLoadingAnimationProps {
  programName: string;
  onComplete: () => void;
}

export function CloneLoadingAnimation({ programName, onComplete }: CloneLoadingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          setTimeout(onComplete, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 700);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center space-y-8 p-8">
        {/* Pulsing icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles size={32} className="text-primary animate-pulse" />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Cloning & Improving</h2>
          <p className="text-sm text-muted-foreground truncate">{programName}</p>
        </div>

        {/* Steps */}
        <div className="space-y-3 text-left">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isDone = i < currentStep;
            const isActive = i === currentStep;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300",
                  isDone && "bg-[hsl(var(--success))]/10",
                  isActive && "bg-primary/10",
                  !isDone && !isActive && "opacity-40"
                )}
              >
                {isDone ? (
                  <CheckCircle2 size={16} className="text-[hsl(var(--success))] shrink-0" />
                ) : isActive ? (
                  <Loader2 size={16} className="text-primary animate-spin shrink-0" />
                ) : (
                  <Icon size={16} className="text-muted-foreground shrink-0" />
                )}
                <span className={cn(
                  "text-sm",
                  isDone && "text-[hsl(var(--success))]",
                  isActive && "text-foreground font-medium",
                  !isDone && !isActive && "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
