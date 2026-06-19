import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalIcon, Info } from "lucide-react";
import type {
  BasicsState,
  AttainmentBasis,
  ProgrammePeriod,
  PayoutFrequency,
} from "../builderState";
import { quarterForMonth } from "@/lib/programStore";

const NAME_MAX_LENGTH = 100;
// Show the character counter once the name is within this many chars of the limit.
const NAME_COUNTER_THRESHOLD = 20;

interface Props {
  value: BasicsState;
  onChange: (v: BasicsState) => void;
  // Accepted for backward compatibility — Channels selection has moved to the KPIs step.
  channels?: string[];
  onChannelsChange?: (v: string[]) => void;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const PERIODS: { id: ProgrammePeriod; label: string; desc?: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  {
    id: "monthly-plus-quarterly",
    label: "Monthly + Quarterly bonus",
    desc: "Monthly KPIs that reset each month, plus a separate quarter-end bonus on cumulative 3-month performance.",
  },
];

const isQuarterScoped = (p: ProgrammePeriod) =>
  p === "quarterly" || p === "monthly-plus-quarterly";

const ATTAIN: { id: AttainmentBasis; label: string; desc: string }[] = [
  { id: "order", label: "Order date", desc: "when order is placed" },
  { id: "invoice", label: "Invoice date", desc: "when invoice is raised" },
];

export function BasicsStep({ value, onChange }: Props) {
  const set = <K extends keyof BasicsState>(k: K, v: BasicsState[K]) =>
    onChange({ ...value, [k]: v });
  const q = quarterForMonth(value.month, value.year);
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // Build 4 quarters based on calendar basis (starting month).
  const fyStart =
    value.calendar.kind === "fiscal" ? value.calendar.startMonth : 1;
  const QUARTERS = [0, 1, 2, 3].map((qi) => {
    const startMonth = ((fyStart - 1 + qi * 3) % 12) + 1;
    const months = [0, 1, 2].map((i) => MONTHS[(startMonth - 1 + i) % 12]);
    return { id: qi + 1, startMonth, label: `Q${qi + 1} — ${months.join(" + ")}` };
  });
  const activeQuarter =
    QUARTERS.find((qq) =>
      [0, 1, 2].some((i) => ((qq.startMonth - 1 + i) % 12) + 1 === value.month),
    ) ?? QUARTERS[0];

  const periodLabel = PERIODS.find((p) => p.id === value.period)?.label ?? "—";
  const whenLabel = isQuarterScoped(value.period)
    ? `Q${activeQuarter.id} ${value.year}`
    : `${MONTHS[value.month - 1]} ${value.year}`;
  const attainLabel = ATTAIN.find((a) => a.id === value.attainmentBasis)?.label ?? "—";
  const payoutLabel =
    value.payoutFrequency === "on-completion"
      ? "On completion"
      : value.payoutFrequency.charAt(0).toUpperCase() + value.payoutFrequency.slice(1);

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl">
      <div>
        <h2 className="text-xl font-semibold">Programme basics</h2>
        <p className="text-sm text-muted-foreground">Set the foundation for your incentive plan.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-5 items-start">
        <div className="space-y-5">
      <Card className="p-5 space-y-2">
        <Label className="text-sm font-medium">Programme name</Label>
        <Input
          placeholder="Enter program name…"
          maxLength={NAME_MAX_LENGTH}
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
        />
        {value.name.length >= NAME_MAX_LENGTH - NAME_COUNTER_THRESHOLD && (
          <p className="text-xs text-muted-foreground text-right tabular-nums">
            {value.name.length}/{NAME_MAX_LENGTH}
          </p>
        )}
      </Card>

      <Card className="p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold">Timing &amp; period</h3>
          <p className="text-xs text-muted-foreground">How the programme aligns to your calendar and how often it runs.</p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Calendar basis</Label>
          <RadioGroup
            value={value.calendar.kind}
            onValueChange={(v) => {
              if (v === "standard") set("calendar", { kind: "standard" });
              else if (v === "fiscal") set("calendar", { kind: "fiscal", startMonth: 4 });
              else set("calendar", { kind: "company" });
            }}
            className="space-y-2"
          >
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="standard" /> Standard calendar (Jan–Dec)
            </label>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="fiscal" /> Fiscal year — starts in:
              </label>
              <Select
                disabled={value.calendar.kind !== "fiscal"}
                value={String(value.calendar.kind === "fiscal" ? value.calendar.startMonth : 4)}
                onValueChange={(v) => set("calendar", { kind: "fiscal", startMonth: Number(v) })}
              >
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="company" /> Company calendar
            </label>
          </RadioGroup>
        </div>

        <div className="border-t border-border" />

        <div className="space-y-3">
          <Label className="text-sm font-medium">Programme period</Label>
          <RadioGroup
            value={value.period}
            onValueChange={(v) => set("period", v as ProgrammePeriod)}
            className="space-y-2"
          >
            {PERIODS.map((p) => (
              <label key={p.id} className="flex items-start gap-2 text-sm cursor-pointer">
                <RadioGroupItem value={p.id} className="mt-0.5" />
                <span>
                  <span className="font-medium">{p.label}</span>
                  {p.desc && (
                    <span className="text-muted-foreground"> — {p.desc}</span>
                  )}
                </span>
              </label>
            ))}
          </RadioGroup>
          {isQuarterScoped(value.period) && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-2">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>Quarter boundaries are determined by your calendar basis selection above.</span>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <CalIcon size={14} /> {isQuarterScoped(value.period) ? "Programme quarter" : "Programme month"}
        </Label>
        <div className="flex items-center gap-2">
          {isQuarterScoped(value.period) ? (
            <Select
              value={String(activeQuarter.id)}
              onValueChange={(v) => {
                const qq = QUARTERS.find((x) => x.id === Number(v));
                if (qq) set("month", qq.startMonth);
              }}
            >
              <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUARTERS.map((qq) => (
                  <SelectItem key={qq.id} value={String(qq.id)}>{qq.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={String(value.month)} onValueChange={(v) => set("month", Number(v))}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={String(value.year)} onValueChange={(v) => set("year", Number(v))}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {value.period === "monthly" && (
            <div className="text-xs text-muted-foreground ml-2">→ <span className="font-medium text-foreground">{q.full}</span></div>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <Label className="text-sm font-medium">Attainment measured on</Label>
        <RadioGroup
          value={value.attainmentBasis}
          onValueChange={(v) => set("attainmentBasis", v as AttainmentBasis)}
          className="space-y-2"
        >
          {ATTAIN.map((a) => (
            <label key={a.id} className="flex items-start gap-2 text-sm cursor-pointer">
              <RadioGroupItem value={a.id} className="mt-0.5" />
              <span className="flex items-center gap-2 flex-wrap">
                <span>
                  <span className="font-medium">{a.label}</span>{" "}
                  <span className="text-muted-foreground">— {a.desc}</span>
                </span>
                {a.id === "invoice" && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                    Most used
                  </span>
                )}
              </span>
            </label>
          ))}
        </RadioGroup>
      </Card>



      <Card className="p-5 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Currency</Label>
          <Select value={value.currency} onValueChange={(v) => set("currency", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR — Indian Rupee</SelectItem>
              <SelectItem value="USD">USD — US Dollar</SelectItem>
              <SelectItem value="EUR">EUR — Euro</SelectItem>
              <SelectItem value="GBP">GBP — British Pound</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Payout frequency</Label>
          <Select value={value.payoutFrequency} onValueChange={(v) => set("payoutFrequency", v as PayoutFrequency)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="on-completion">On completion</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
        </div>

        <aside className="lg:sticky lg:top-4 min-w-0">
          <Card className="p-5 space-y-4 border-l-4 border-l-primary">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Programme summary
              </div>
              <div
                className={`text-base break-words line-clamp-2 ${
                  value.name.trim()
                    ? "font-bold text-foreground"
                    : "italic font-normal text-muted-foreground"
                }`}
                title={value.name.trim() || "Untitled programme"}
              >
                {value.name.trim() || "Untitled programme"}
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              <SummaryRow label="Period" value={periodLabel} />
              <SummaryRow label="When" value={whenLabel} />
              <SummaryRow label="Attainment" value={attainLabel} />
              <SummaryRow label="Currency" value={value.currency} />
              <SummaryRow label="Payout" value={payoutLabel} />
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
              <span aria-hidden>💡</span>
              <span>A clear name makes it easy to find this programme later.</span>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

export function isBasicsComplete(b: BasicsState) {
  return b.name.trim().length > 0;
}
