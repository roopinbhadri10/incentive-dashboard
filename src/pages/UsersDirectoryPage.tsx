import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Search,
  Users,
  Target,
  TrendingUp,
  IndianRupee,
  Sparkles,
  MapPin,
  Briefcase,
  RotateCcw,
} from "lucide-react";
import { listBatches, type UserListUser } from "@/lib/userListsStore";
import { listPrograms, type SavedProgram } from "@/lib/programStore";

/** Roles offered in the directory's role filter. */
const PROGRAM_ROLES = [
  "Urban Retail MR",
  "Urban Wholesale MR",
  "Hybrid MR",
  "Rural MR (Super Stockist)",
  "ASO/ASE",
] as const;

interface DirectoryUser extends UserListUser {
  role: string;
  batchId: string;
}

const DEMO_PROGRAM = (role: string): SavedProgram => ({
  id: "demo_program",
  name: "Q3 FY26 Sales Accelerator (Demo)",
  role,
  geographies: ["All regions"],
  monthYear: { month: 7, year: 2026 },
  quarterLabel: "Q2 FY27",
  attainmentBasis: "invoice",
  currency: "INR",
  payoutFrequency: "monthly",
  kpis: [],
  gates: [],
  createdAt: new Date().toISOString(),
});

// Deterministic pseudo-random based on string
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(seed: string, list: T[]): T {
  return list[hash(seed) % list.length];
}

interface SimKpi {
  name: string;
  weight: number;       // % weight in program
  target: number;       // target value
  actual: number;       // actual achieved
  attainment: number;   // % attainment
  maxPayout: number;    // max ₹ for this KPI
  payout: number;       // current ₹ earned
  unit: string;
}

const KPI_TEMPLATES = [
  { name: "Secondary Sales (NSV)", unit: "₹L", base: 12, max: 8000 },
  { name: "Outlet Coverage", unit: "outlets", base: 180, max: 4000 },
  { name: "Productive Calls", unit: "calls", base: 220, max: 3500 },
  { name: "New Outlet Activation", unit: "outlets", base: 25, max: 3000 },
  { name: "Focus SKU Lines", unit: "lines", base: 8, max: 2500 },
  { name: "Range Selling", unit: "%", base: 75, max: 2000 },
];

function buildSimKpis(seedKey: string): SimKpi[] {
  const h = hash(seedKey);
  const count = 3 + (h % 3); // 3-5 KPIs
  const chosen = KPI_TEMPLATES.slice(0, count);
  const rawWeights = chosen.map((_, i) => 15 + ((hash(seedKey + i) % 25)));
  const totalW = rawWeights.reduce((a, b) => a + b, 0);
  return chosen.map((t, i) => {
    const weight = Math.round((rawWeights[i] / totalW) * 100);
    const attainment = 45 + (hash(seedKey + t.name) % 80); // 45-124%
    const target = Math.round(t.base * (0.8 + ((hash(seedKey + "t" + i) % 50) / 100)));
    const actual = Math.round((target * attainment) / 100);
    const payout = computePayout(t.max, attainment);
    return {
      name: t.name,
      weight,
      target,
      actual,
      attainment,
      maxPayout: t.max,
      payout,
      unit: t.unit,
    };
  });
}

// Simple slab logic: <60% = 0, 60-79% = 40% of max, 80-99% = 70% of max,
// 100-119% = 100% of max, 120%+ = 120% of max (accelerator capped)
function computePayout(max: number, attainment: number): number {
  if (attainment < 60) return 0;
  if (attainment < 80) return Math.round(max * 0.4);
  if (attainment < 100) return Math.round(max * 0.7);
  if (attainment < 120) return Math.round(max * 1.0);
  return Math.round(max * 1.2);
}

function fmtCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

export function UsersDirectoryPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [openUser, setOpenUser] = useState<DirectoryUser | null>(null);

  const allUsers: DirectoryUser[] = useMemo(() => {
    return listBatches().flatMap((b) =>
      b.users.map((u) => ({ ...u, role: b.role, batchId: b.id })),
    );
  }, []);

  const allPrograms: SavedProgram[] = useMemo(() => listPrograms(), []);

  // Find an "active" program for a given role.
  // Preference: exact role match → any saved programme → synthetic demo programme
  // so every user has something to inspect & simulate.
  const programForRole = (role: string): SavedProgram => {
    const exact = allPrograms.find((p) => p.role === role);
    if (exact) return exact;
    if (allPrograms.length > 0) return allPrograms[0];
    return DEMO_PROGRAM(role);
  };

  const regions = useMemo(() => {
    const s = new Set<string>();
    allUsers.forEach((u) => u.region && s.add(u.region));
    return Array.from(s).sort();
  }, [allUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (regionFilter !== "all" && u.region !== regionFilter) return false;
      if (activeFilter === "active" && !u.active) return false;
      if (activeFilter === "inactive" && u.active) return false;
      if (q) {
        const hay = `${u.name} ${u.empId} ${u.email} ${u.city} ${u.state}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allUsers, search, roleFilter, regionFilter, activeFilter]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="bg-card rounded-xl mx-4 mt-4 mb-4 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-[26px] bg-primary rounded-full" />
          <p className="text-xs text-muted-foreground">
            Look up any user to view their active programme, KPI coverage, current payout, and run a quick simulation.
          </p>
        </div>


        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, employee ID, email, city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {PROGRAM_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Region" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All regions</SelectItem>
                  {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary" className="text-[10px]">{filtered.length} matched</Badge>
            <Badge variant="secondary" className="text-[10px]">{allUsers.length} total</Badge>
            {(search || roleFilter !== "all" || regionFilter !== "all" || activeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs ml-auto"
                onClick={() => { setSearch(""); setRoleFilter("all"); setRegionFilter("all"); setActiveFilter("all"); }}
              >
                <RotateCcw size={12} className="mr-1" /> Clear filters
              </Button>
            )}
          </div>
        </Card>

        {/* Results */}
        {allUsers.length === 0 ? (
          <Card className="p-10 border-dashed text-center">
            <Users className="mx-auto mb-2 text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground">No users available yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload user lists on the <span className="font-medium">Users List</span> page to populate the directory.
            </p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-10 border-dashed text-center">
            <Search className="mx-auto mb-2 text-muted-foreground" size={28} />
            <p className="text-sm text-muted-foreground">No users match these filters.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 text-xs">Employee</TableHead>
                    <TableHead className="h-9 text-xs">Role</TableHead>
                    <TableHead className="h-9 text-xs">Location</TableHead>
                    <TableHead className="h-9 text-xs">Active programme</TableHead>
                    <TableHead className="h-9 text-xs">KPI coverage</TableHead>
                    <TableHead className="h-9 text-xs text-right">Current payout</TableHead>
                    <TableHead className="h-9 text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const prog = programForRole(u.role);
                    const seed = u.empId + (prog?.id ?? "noprog");
                    const kpis = prog ? buildSimKpis(seed) : [];
                    const totalMax = kpis.reduce((s, k) => s + k.maxPayout, 0);
                    const totalPayout = kpis.reduce((s, k) => s + k.payout, 0);
                    const coverage = totalMax === 0 ? 0 : Math.round((totalPayout / totalMax) * 100);
                    return (
                      <TableRow
                        key={u.batchId + u.empId}
                        className={!u.active ? "opacity-60" : ""}
                      >
                        <TableCell className="py-2">
                          <div className="text-xs font-semibold">{u.name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">{u.empId}</div>
                        </TableCell>
                        <TableCell className="py-2 text-xs">{u.role}</TableCell>
                        <TableCell className="py-2 text-xs">
                          <div>{u.city || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{u.region}{u.state ? ` · ${u.state}` : ""}</div>
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {prog ? (
                            <div>
                              <div className="font-medium truncate max-w-[180px]">{prog.name}</div>
                              <div className="text-[10px] text-muted-foreground">{prog.quarterLabel}</div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">No active programme</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2 w-[160px]">
                          {prog ? (
                            <div className="space-y-1">
                              <Progress value={coverage} className="h-1.5" />
                              <div className="text-[10px] text-muted-foreground">{coverage}% of max · {kpis.length} KPIs</div>
                            </div>
                          ) : <span className="text-[10px] text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right font-semibold">
                          {prog ? fmtCurrency(totalPayout) : "—"}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setOpenUser(u)}
                            disabled={!prog}
                          >
                            View details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      <UserDetailSheet
        user={openUser}
        program={openUser ? programForRole(openUser.role) : undefined}
        onClose={() => setOpenUser(null)}
      />
    </div>
  );
}

function UserDetailSheet({
  user,
  program,
  onClose,
}: {
  user: DirectoryUser | null;
  program: SavedProgram | undefined;
  onClose: () => void;
}) {
  const seed = user && program ? user.empId + program.id : "x";
  const initial = useMemo(() => (user && program ? buildSimKpis(seed) : []), [seed, user, program]);

  // Simulated attainment overrides
  const [sim, setSim] = useState<Record<string, number>>({});

  // Reset overrides whenever the user changes
  const userKey = user ? user.empId : "";
  useEffect(() => { setSim({}); }, [userKey]);

  if (!user) return null;

  const kpis = initial.map((k) => {
    const att = sim[k.name] ?? k.attainment;
    const actual = Math.round((k.target * att) / 100);
    return { ...k, attainment: att, actual, payout: computePayout(k.maxPayout, att) };
  });
  const totalMax = kpis.reduce((s, k) => s + k.maxPayout, 0);
  const totalPayout = kpis.reduce((s, k) => s + k.payout, 0);
  const coverage = totalMax === 0 ? 0 : Math.round((totalPayout / totalMax) * 100);

  const basePayout = initial.reduce((s, k) => s + k.payout, 0);
  const delta = totalPayout - basePayout;

  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              {user.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base">{user.name}</SheetTitle>
              <SheetDescription className="text-xs">
                <span className="font-mono">{user.empId}</span> · {user.email || "—"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Meta strip */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <MetaTile icon={<Briefcase size={12} />} label="Role" value={user.role} />
          <MetaTile icon={<MapPin size={12} />} label="Location" value={`${user.city || "—"}${user.state ? ", " + user.state : ""}`} />
          <MetaTile icon={<Users size={12} />} label="Reporting to" value={user.reportingManager || "—"} />
        </div>

        {!program ? (
          <Card className="p-6 mt-4 border-dashed text-center">
            <p className="text-sm text-muted-foreground">No active programme for this role yet.</p>
          </Card>
        ) : (
          <>
            {/* Programme summary */}
            <Card className="p-4 mt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Active programme</div>
                  <div className="text-sm font-semibold mt-0.5 truncate">{program.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {program.quarterLabel} · {program.payoutFrequency} payout · {program.currency}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">{program.role}</Badge>
              </div>
            </Card>

            {/* Headline metrics */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <StatTile
                icon={<Target size={14} />}
                label="KPI coverage"
                value={`${coverage}%`}
                sub={`${kpis.length} KPIs tracked`}
              />
              <StatTile
                icon={<IndianRupee size={14} />}
                label="Current payout"
                value={fmtCurrency(totalPayout)}
                sub={`of ${fmtCurrency(totalMax)} max`}
              />
              <StatTile
                icon={<TrendingUp size={14} />}
                label="Vs actual"
                value={(delta >= 0 ? "+" : "") + fmtCurrency(delta)}
                sub={delta === 0 ? "no change" : "from simulation"}
                tone={delta > 0 ? "pos" : delta < 0 ? "neg" : "neutral"}
              />
            </div>

            {/* Simulator */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" />
                  <h3 className="text-sm font-semibold">Quick payout simulator</h3>
                </div>
                {Object.keys(sim).length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSim({})}>
                    <RotateCcw size={12} className="mr-1" /> Reset
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Drag the sliders to see how changing attainment per KPI would change this user's payout. Slabs: &lt;60% = 0, 60–79% = 40%, 80–99% = 70%, 100–119% = 100%, 120%+ = 120%.
              </p>

              <div className="space-y-3">
                {kpis.map((k) => (
                  <Card key={k.name} className="p-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{k.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Weight {k.weight}% · Target {k.target.toLocaleString("en-IN")} {k.unit} · Max {fmtCurrency(k.maxPayout)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-primary">{fmtCurrency(k.payout)}</div>
                        <div className="text-[10px] text-muted-foreground">payout</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Slider
                        min={0}
                        max={150}
                        step={5}
                        value={[k.attainment]}
                        onValueChange={(v) => setSim((s) => ({ ...s, [k.name]: v[0] }))}
                        className="flex-1"
                      />
                      <div className="w-24 text-right">
                        <div className="text-xs font-semibold">{k.attainment}%</div>
                        <div className="text-[10px] text-muted-foreground">
                          {k.actual.toLocaleString("en-IN")} {k.unit}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetaTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="text-xs font-medium mt-1 truncate">{value}</div>
    </Card>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "pos" | "neg" | "neutral";
}) {
  const toneClass =
    tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-rose-600" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`text-base font-semibold mt-1 ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </Card>
  );
}
