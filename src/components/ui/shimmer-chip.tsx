import { cn } from "@/lib/utils";

interface ShimmerChipProps {
  /** Text inside the coloured pill, e.g. "LIVE" */
  badge: string;
  /** Message shown next to the pill */
  label: string;
  /** Colour treatment of the pill */
  tone?: "live" | "primary" | "muted";
  className?: string;
}

const toneStyles: Record<NonNullable<ShimmerChipProps["tone"]>, string> = {
  live: "bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground",
  primary: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function ShimmerChip({ badge, label, tone = "live", className }: ShimmerChipProps) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-border/60 bg-card py-1.5 pl-1.5 pr-5 shadow-sm",
        className
      )}
    >
      <span className="shimmer-sweep absolute inset-0 pointer-events-none" aria-hidden />
      <span
        className={cn(
          "relative inline-flex items-center gap-2 overflow-hidden rounded-full px-3 py-1 text-[11px] font-bold tracking-wider shadow-sm",
          toneStyles[tone]
        )}
      >
        <span className="shimmer-sweep absolute inset-0 pointer-events-none" aria-hidden />
        <span className="relative h-1.5 w-1.5 rounded-full bg-white/90" />
        <span className="relative">{badge}</span>
      </span>
      <span className="relative text-sm font-medium text-foreground/80">{label}</span>
    </div>
  );
}
