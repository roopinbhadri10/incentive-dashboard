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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar as CalIcon, Info } from "lucide-react";
import type {
  BasicsState,
  AttainmentBasis,
  ProgrammePeriod,
} from "../builderState";
import { programmeWindowLabel } from "../builderState";

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

export const BASICS_NAME_FIELD_ID = "basics-programme-name";

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

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex text-muted-foreground hover:text-foreground transition-colors" aria-label="More info">
            <Info size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BasicsStep({ value, onChange }: Props) {
  const set = <K extends keyof BasicsState>(k: K, v: BasicsState[K]) =>
    onChange({ ...value, [k]: v });
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

  const periodLabel = PERIODS.find((p) => p.id === value.period)?.label ?? "Monthly";
  const whenLabel = isQuarterScoped(value.period)
    ? `Q${activeQuarter.id} ${value.year}`
    : `${MONTHS[value.month - 1]} ${value.year}`;
  const attainLabel = ATTAIN.find((a) => a.id === value.attainmentBasis)?.label ?? "—";

  // Suggested name built from the current period / timing / attainment choices.
  const periodPart = periodLabel.replace(" bonus", "");
  const attainShort = value.attainmentBasis === "invoice" ? "Invoice" : "Order";
  const suggestion = `${periodPart} — ${whenLabel} — ${attainShort}`;
  const matchesSuggestion = value.name.trim() === suggestion;

  return (
    <div className="animate-fade-in space-y-8">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Programme basics</h2>
        <p className="text-sm text-muted-foreground">Set the foundation for your incentive plan.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="space-y-6">
          {/* Name card */}
          <Card className="rounded-2xl border border-border/60 bg-card p-6 shadow-none">
            <div className="space-y-3">
              <Label htmlFor={BASICS_NAME_FIELD_ID} className="text-sm font-medium text-foreground">
                Programme name
              </Label>
              <Input
                id={BASICS_NAME_FIELD_ID}
                placeholder="e.g. Q3 Volume Push — Urban"
                maxLength={NAME_MAX_LENGTH}
                value={value.name}
                onChange={(e) => set("name", e.target.value)}
                className="h-11 rounded-xl border-border/80 bg-background text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
              />
              {value.name.length >= NAME_MAX_LENGTH - NAME_COUNTER_THRESHOLD && (
                <p className="text-xs text-muted-foreground text-right tabular-nums">
                  {value.name.length}/{NAME_MAX_LENGTH}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Suggested: <span className="text-foreground font-medium">{suggestion}</span></span>
                {!matchesSuggestion && (
                  <button
                    type="button"
                    onClick={() => set("name", suggestion.slice(0, NAME_MAX_LENGTH))}
                    className="text-primary font-medium hover:underline"
                  >
                    Use this
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Timing & period card */}
          <Card className="rounded-2xl border border-border/60 bg-card p-6 shadow-none">
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-foreground">Timing &amp; period</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium text-foreground">Calendar basis</Label>
                    <InfoTip text="Determines how months and quarters are aligned for this programme." />
                  </div>
                  <RadioGroup
                    value={value.calendar.kind}
                    onValueChange={(v) => {
                      if (v === "standard") set("calendar", { kind: "standard" });
                      else if (v === "fiscal") set("calendar", { kind: "fiscal", startMonth: 4 });
                      else set("calendar", { kind: "company" });
                    }}
                    className="space-y-2"
                  >
                    <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                      <RadioGroupItem value="standard" />
                      <span className="text-foreground/90 group-hover:text-foreground transition-colors">Standard calendar (Jan–Dec)</span>
                    </label>
                    <div className="flex items-center gap-2.5 text-sm flex-wrap">
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <RadioGroupItem value="fiscal" />
                        <span className="text-foreground/90 group-hover:text-foreground transition-colors">Fiscal year</span>
                      </label>
                      {value.calendar.kind === "fiscal" && (
                        <>
                          <span className="text-muted-foreground text-xs">starts in</span>
                          <Select
                            value={String(value.calendar.startMonth)}
                            onValueChange={(v) => set("calendar", { kind: "fiscal", startMonth: Number(v) })}
                          >
                            <SelectTrigger className="h-8 w-24 text-xs rounded-lg border-border/70"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MONTHS.map((m, i) => (
                                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                    </div>
                    <label className="flex items-center gap-2.5 text-sm cursor-pointer group">
                      <RadioGroupItem value="company" />
                      <span className="text-foreground/90 group-hover:text-foreground transition-colors">Company calendar</span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium text-foreground">Programme period</Label>
                    {isQuarterScoped(value.period) && (
                      <InfoTip text="Quarter boundaries are determined by your calendar basis selection." />
                    )}
                  </div>
                  <RadioGroup
                    value={value.period}
                    onValueChange={(v) => set("period", v as ProgrammePeriod)}
                    className="space-y-2"
                  >
                    {PERIODS.map((p) => (
                      <label key={p.id} className="flex items-start gap-2.5 text-sm cursor-pointer group">
                        <RadioGroupItem value={p.id} className="mt-0.5" />
                        <span className="flex items-center gap-1.5">
                          <span className="text-foreground/90 group-hover:text-foreground transition-colors">{p.label}</span>
                          {p.desc && <InfoTip text={p.desc} />}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <CalIcon size={14} className="text-muted-foreground" /> {isQuarterScoped(value.period) ? "Programme quarter" : "Programme month"}
                  </Label>
                  {isQuarterScoped(value.period) ? (
                    <Select
                      value={String(activeQuarter.id)}
                      onValueChange={(v) => {
                        const qq = QUARTERS.find((x) => x.id === Number(v));
                        if (qq) set("month", qq.startMonth);
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QUARTERS.map((qq) => (
                          <SelectItem key={qq.id} value={String(qq.id)}>{qq.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={String(value.month)} onValueChange={(v) => set("month", Number(v))}>
                      <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {value.period === "monthly" && (
                    // The window first, then the quarter as labelled context. A bare
                    // "→ Q2 FY27 (Jul + Aug + Sep)" read as the programme's own span,
                    // which for a monthly programme is the single month above. The
                    // quarter comes from activeQuarter (the same calendar basis the
                    // quarter picker in this card uses), not a fixed-April fiscal year.
                    <div className="text-xs text-muted-foreground">
                      Runs <span className="font-medium text-foreground">{programmeWindowLabel(value)}</span>
                      {` · within Q${activeQuarter.id} ${value.year}`}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Year</Label>
                  <Select value={String(value.year)} onValueChange={(v) => set("year", Number(v))}>
                    <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          {/* Attainment card */}
          <Card className="rounded-2xl border border-border/60 bg-card p-6 shadow-none">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Attainment measured on</Label>
              <RadioGroup
                value={value.attainmentBasis}
                onValueChange={(v) => set("attainmentBasis", v as AttainmentBasis)}
                className="space-y-2"
              >
                {ATTAIN.map((a) => (
                  <label key={a.id} className="flex items-start gap-2.5 text-sm cursor-pointer group">
                    <RadioGroupItem value={a.id} className="mt-0.5" />
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-foreground/90 group-hover:text-foreground transition-colors">{a.label}</span>
                      <InfoTip text={a.desc} />
                      {a.id === "invoice" && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-medium">
                          Most used
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </Card>
        </div>

        {/* Light sticky summary */}
        <Card className="rounded-2xl border border-border/60 bg-card p-5 lg:sticky lg:top-4 shadow-none space-y-4">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              Programme summary
            </p>
            <p
              className="mt-1 text-sm font-medium text-foreground break-words"
              title={value.name.trim() || "Untitled programme"}
            >
              {value.name.trim() || <span className="text-muted-foreground italic font-normal">Untitled programme</span>}
            </p>
          </div>
          <div className="space-y-2.5 text-xs">
            <SummaryRow label="Period" value={periodLabel} />
            <SummaryRow label="When" value={whenLabel} />
            <SummaryRow label="Attainment" value={attainLabel} />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            A clear name makes it easy to find this programme later.
          </p>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

export function isBasicsComplete(b: BasicsState) {
  return b.name.trim().length > 0;
}
