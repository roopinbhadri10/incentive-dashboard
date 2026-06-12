import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { NsvTemplateCard } from "./NsvTemplateCard";
import { DEFAULT_NSV, type NsvTemplateConfig } from "./nsvTypes";

// Structurally identical to the (Secondary) NSV KPI — only difference is
// the cadence is the entire quarter rather than a single month.
export type QuarterlyNsvConfig = NsvTemplateConfig;

const DEFAULT_QNSV_KEY_NOTES = [
  "Quarterly bonus on top of 3× monthly NSV.",
  "Same slab structure as monthly NSV, paid at quarter end.",
  "Computed on cumulative quarterly Secondary NSV vs quarterly target.",
];

// FY starts April. Q1 = Apr+May+Jun.
function currentFiscalQuarter(date = new Date()) {
  const m = date.getMonth();
  const y = date.getFullYear();
  const fyYear = m >= 3 ? y + 1 : y;
  const fyShort = `FY${String(fyYear).slice(-2)}`;
  const fyMonthIdx = (m - 3 + 12) % 12;
  const q = Math.floor(fyMonthIdx / 3) + 1;
  const startMonth = 3 + (q - 1) * 3;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months = [startMonth % 12, (startMonth + 1) % 12, (startMonth + 2) % 12].map((i) => names[i]);
  return { label: `Q${q} ${fyShort}`, period: months.join(" + ") };
}

export const DEFAULT_QNSV: QuarterlyNsvConfig = {
  ...structuredClone(DEFAULT_NSV),
  basis: "secondary",
  keyNotes: [...DEFAULT_QNSV_KEY_NOTES],
};

interface Props {
  value?: QuarterlyNsvConfig;
  onChange?: (v: QuarterlyNsvConfig) => void;
  // Legacy props from previous role-based version — accepted but ignored
  // so existing call sites don't break.
  lockedRole?: "mr" | "aso";
  hideRoleSelector?: boolean;
}

export function QuarterlyNsvTemplateCard({ value, onChange }: Props = {}) {
  const quarter = useMemo(() => currentFiscalQuarter(), []);
  return (
    <NsvTemplateCard
      value={value ?? DEFAULT_QNSV}
      onChange={onChange}
      selfId="quarterly_nsv"
      title="Quarterly NSV Bonus"
      description="Cumulative quarterly Secondary NSV vs quarterly target — same slab structure as monthly NSV."
      cadenceLabel="Quarterly payout"
      extraHeaderBadges={
        <Badge variant="outline" className="text-[10px] gap-1">
          <Calendar size={10} /> {quarter.label} ({quarter.period})
        </Badge>
      }
      basisTitle="Quarterly NSV Basis"
      basisSfaKey="quarterly"
      kpiNoun="Quarterly NSV"
      maxEarningLabel="Max quarterly earning"
      defaultKeyNotes={DEFAULT_QNSV_KEY_NOTES}
      footer={
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
          <Calendar size={12} className="mt-0.5 shrink-0" />
          Payout is locked to <span className="font-medium text-foreground mx-1">quarter end</span>{" "}
          and is on top of the 3 monthly NSV payouts within {quarter.label}.
        </div>
      }
    />
  );
}
