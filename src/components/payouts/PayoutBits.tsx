import { cn } from "@/lib/utils";
import {
  METHOD_HEX,
  METHOD_STYLE,
  METHOD_LABEL,
  STATUS_STYLES,
  type PayoutMethod,
  type RunStatus,
} from "./payoutData";

export function StatusPill({ status, className }: { status: RunStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        STATUS_STYLES[status],
        className
      )}
    >
      {status}
    </span>
  );
}

export function MethodPill({ method }: { method: PayoutMethod }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        METHOD_STYLE[method]
      )}
    >
      {METHOD_LABEL[method]}
    </span>
  );
}

export function MethodMixBar({
  mix,
}: {
  mix: { method: PayoutMethod; pct: number }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        {mix.map((m) => (
          <div
            key={m.method}
            style={{ width: `${m.pct}%`, backgroundColor: METHOD_HEX[m.method] }}
            title={`${METHOD_LABEL[m.method]} · ${m.pct.toFixed(0)}%`}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">{mix.length} ways</span>
    </div>
  );
}

export function MethodDonut({
  mix,
  size = 132,
}: {
  mix: { method: PayoutMethod; pct: number; amount: number }[];
  size?: number;
}) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={14} />
        {mix.map((m) => {
          const len = (m.pct / 100) * c;
          const el = (
            <circle
              key={m.method}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={METHOD_HEX[m.method]}
              strokeWidth={14}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Methods</span>
        <span className="text-lg font-bold text-foreground">{mix.length}</span>
      </div>
    </div>
  );
}
