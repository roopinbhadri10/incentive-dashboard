import { useState } from "react";
import { Plug, Check, Gift, Landmark, Wallet as WalletIcon, Ticket, Send, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MethodPill } from "./PayoutBits";
import {
  fmt,
  METHOD_LABEL,
  REWARD_CATALOGUE,
  type MethodPolicy,
  type PayoutMethod,
  type Redemption,
  type RewardItem,
  type RewardProvider,
} from "./payoutData";

const ICONS: Record<PayoutMethod, React.ElementType> = {
  Bank: Landmark,
  Amazon: Gift,
  Voucher: Ticket,
  Wallet: WalletIcon,
};

const redemptionStyle: Record<string, string> = {
  Delivered: "bg-blue-50 text-blue-700 border-blue-200",
  Redeemed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Failed: "bg-rose-50 text-rose-700 border-rose-200",
};

interface Props {
  providers: RewardProvider[];
  onToggleProvider: (id: string) => void;
  policies: MethodPolicy[];
  onUpdatePolicy: (programme: string, patch: Partial<MethodPolicy>) => void;
  redemptions: Redemption[];
  onResend: (id: string) => void;
}

export function RewardsPanel({
  providers,
  onToggleProvider,
  policies,
  onUpdatePolicy,
  redemptions,
  onResend,
}: Props) {
  const [catalogue, setCatalogue] = useState<RewardItem[]>(REWARD_CATALOGUE);
  const [section, setSection] = useState<"providers" | "catalogue" | "policy" | "issuance">("providers");

  const toggleReward = (id: string) => {
    setCatalogue((c) => c.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const tabs = [
    ["providers", "Providers"],
    ["catalogue", "Reward catalogue"],
    ["policy", "Redemption policy"],
    ["issuance", "Issued rewards"],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-full border border-border bg-muted/40 p-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              section === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "providers" && (
        <div className="grid gap-3 md:grid-cols-2">
          {providers.map((p) => {
            const Icon = ICONS[p.kind];
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">{p.name}</h3>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          p.connected
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-border bg-muted text-muted-foreground"
                        )}
                      >
                        {p.connected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{p.blurb}</p>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        ["Balance available", p.connected ? fmt(p.float) : "—"],
                        ["Fee", p.fee],
                        ["Speed", p.tat],
                      ].map(([l, v]) => (
                        <div key={l} className="rounded-xl bg-muted/50 px-2 py-1.5">
                          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{l}</div>
                          <div className="truncate text-[11px] font-semibold text-foreground">{v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{p.coverage}</span>
                      <Button
                        size="sm"
                        variant={p.connected ? "outline" : "default"}
                        className="h-7 gap-1.5 text-[11px]"
                        onClick={() => onToggleProvider(p.id)}
                      >
                        {p.connected ? <Check size={12} /> : <Plug size={12} />}
                        {p.connected ? "Manage" : "Connect"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-[11px] text-muted-foreground md:col-span-2">
            <Info size={13} className="mr-1 inline text-primary" />
            Provider connections are simulated in this build. Live issuance with Amazon Incentives or a voucher
            aggregator needs API credentials and a server-side issuance job.
          </div>
        </div>
      )}

      {section === "catalogue" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {catalogue.map((r) => (
            <div
              key={r.id}
              className={cn(
                "rounded-2xl border bg-card p-3.5 transition-opacity",
                r.enabled ? "border-border" : "border-dashed border-border opacity-60"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{r.brand}</div>
                  <div className="text-[10px] text-muted-foreground">{r.category}</div>
                </div>
                <Switch checked={r.enabled} onCheckedChange={() => toggleReward(r.id)} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {r.denominations.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] tabular-nums text-foreground"
                  >
                    ₹{d}
                  </span>
                ))}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{r.provider}</span>
                <span>Speed: {r.tat}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {section === "policy" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Admin sets the default method and the other methods a rep may switch to. Reps choose their own split at redemption,
            within these caps.
          </p>
          {policies.map((pol) => (
            <div key={pol.programme} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold text-foreground">{pol.programme}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {pol.allowed.map((m) => (
                      <MethodPill key={m} method={m} />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Default method</div>
                  <Select
                    value={pol.defaultMethod}
                    onValueChange={(v) => onUpdatePolicy(pol.programme, { defaultMethod: v as PayoutMethod })}
                  >
                    <SelectTrigger className="mt-1 h-8 w-[150px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pol.allowed.map((m) => (
                        <SelectItem key={m} value={m}>
                          {METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max non-cash %</div>
                  <NumberInput
                    value={pol.maxNonCashPct}
                    min={0}
                    max={100}
                    onValueChange={(maxNonCashPct) =>
                      onUpdatePolicy(pol.programme, { maxNonCashPct })
                    }
                    className="mt-1 h-8 w-24 text-xs tabular-nums"
                  />
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Min bank %</div>
                  <NumberInput
                    value={pol.minBankPct}
                    min={0}
                    max={100}
                    onValueChange={(minBankPct) => onUpdatePolicy(pol.programme, { minBankPct })}
                    className="mt-1 h-8 w-24 text-xs tabular-nums"
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
            Tax note: incentives paid as gift cards or vouchers remain taxable perquisites. TDS is computed on the
            gross incentive value regardless of the method chosen by the rep.
          </div>
        </div>
      )}

      {section === "issuance" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold text-foreground">Issued reward codes</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={() => toast.success("Issuance report queued · rewards.csv")}
            >
              Export
            </Button>
          </div>
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[100px]" />
              <col className="w-[130px]" />
              <col />
              <col className="w-[140px]" />
              <col className="w-[100px]" />
              <col className="w-[150px]" />
              <col className="w-[90px]" />
              <col className="w-[110px]" />
              <col className="w-[100px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Run</th>
                <th className="px-3 py-2 text-left font-semibold">Rep</th>
                <th className="px-3 py-2 text-left font-semibold">Brand</th>
                <th className="px-3 py-2 text-right font-semibold">Value</th>
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">Channel</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((rd) => (
                <tr key={rd.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{rd.id}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{rd.runId}</td>
                  <td className="truncate px-3 py-2.5 text-xs font-medium text-foreground">{rd.rep}</td>
                  <td className="px-3 py-2.5 text-xs text-foreground">{rd.brand}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">{fmt(rd.amount)}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{rd.code}</td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{rd.channel}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        redemptionStyle[rd.status]
                      )}
                    >
                      {rd.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => onResend(rd.id)}
                    >
                      {rd.status === "Failed" ? <RotateCcw size={12} /> : <Send size={12} />}
                      {rd.status === "Failed" ? "Reissue" : "Resend"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
