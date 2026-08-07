// The expanded programme panel must show what GET /v1/programs/analytics reports —
// nothing derived locally. Renders the programmes list against the engine's real
// response shape and asserts the panel reads back the engine's numbers.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProgramsPage } from "@/pages/ProgramsPage";
import type { RuleRecord } from "@/lib/ruleApi";
import type { ProgramAnalytics } from "@/lib/analyticsApi";

vi.mock("@/lib/ruleApi", () => ({ fetchRules: vi.fn(), archiveRule: vi.fn() }));
vi.mock("@/lib/analyticsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analyticsApi")>()),
  fetchProgramAnalytics: vi.fn(),
}));
import { fetchRules } from "@/lib/ruleApi";
import { fetchProgramAnalytics } from "@/lib/analyticsApi";

const PROGRAM_ID = "default-program";

/** One rule per KPI, all stamped with the same programId (as publish does). */
const rule = (n: number, kpiCode: string): RuleRecord => ({
  id: `rule-${n}`,
  programId: PROGRAM_ID,
  ruleName: "CCD ASO/ASE - KERALA",
  ruleCode: `RULE-2026-08-01-${n}`,
  status: "APPROVED",
  isActive: true,
  effectiveFrom: "2026-08-01",
  effectiveTill: "2026-12-31",
  ruleDefinition: {
    kpiCode,
    kpiName: kpiCode,
    tiers: [{ minVal: 80, maxVal: 9999, payout: 4000 }],
  },
  applicabilityCriteria: { operator: "AND", conditions: [] },
});

/** Trimmed from the engine's live response — the ACTIVE record with a breakdown. */
const analytics: ProgramAnalytics = {
  programId: PROGRAM_ID,
  programName: "CCD ASO/ASE - KERALA",
  period: "2026-07",
  status: "ACTIVE",
  budgetUsed: 1160525.33,
  budgetUsedPct: 51.24,
  totalBudget: 2265000.0,
  maxMonthlyEarning: 15000.0,
  overallAttainmentPct: 71.75,
  attainmentDelta: -28.25,
  estimatedPayout: 10762.5,
  kpisTotalCount: 4,
  kpisOnTrackCount: 3,
  kpisNeedAttentionCount: 1,
  kpiTrackSublabel: "1 need attention",
  gatesCount: 1,
  rolesCoveredCount: 1,
  totalUsers: 50,
  engagedUsers: 38,
  engagedPct: 76.0,
  kpiPerformanceList: [
    { kpiKey: "ATTENDANCE", kpiName: "ATTENDANCE", attainmentPct: 94.6, barWidthPct: 78.83, statusTag: "ON_TRACK", statusLabel: "On track", projectedPayout: 14700, arcSharePct: 34.61 },
    { kpiKey: "EFFECTIVE_COVERAGE", kpiName: "EFFECTIVE_COVERAGE", attainmentPct: 90.0, barWidthPct: 75.0, statusTag: "ON_TRACK", statusLabel: "On track", projectedPayout: 14700, arcSharePct: 32.93 },
    { kpiKey: "TARGET_VS_ACHIEVEMENT", kpiName: "TARGET_VS_ACHIEVEMENT", attainmentPct: 88.73, barWidthPct: 73.94, statusTag: "WATCH", statusLabel: "Watch", projectedPayout: 14700, arcSharePct: 32.46 },
    { kpiKey: "UNIQUE_LINE_COUNT", kpiName: "UNIQUE_LINE_COUNT", attainmentPct: 0.0, barWidthPct: 0.0, statusTag: "AT_RISK", statusLabel: "At risk", projectedPayout: 14700, arcSharePct: 0.0 },
  ],
};

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProgramsPage
        onCreateNew={() => {}}
        onOpenProgram={() => {}}
        onCloneProgram={() => {}}
        onCloneMultiple={() => {}}
      />
    </QueryClientProvider>,
  );
}

async function expandTheRow() {
  renderList();
  const row = await screen.findByRole("button", { name: /view details/i });
  fireEvent.click(row);
}

describe("expanded programme panel — analytics wiring", () => {
  beforeEach(() => {
    vi.mocked(fetchRules).mockResolvedValue([
      rule(1, "TARGET_VS_ACHIEVEMENT"),
      rule(2, "ECO"),
      rule(3, "UNIQUE_LINE_COUNT"),
      rule(4, "COLLECTION"),
    ]);
    vi.mocked(fetchProgramAnalytics).mockResolvedValue([analytics]);
  });

  it("fills the metric strip from the engine's figures", async () => {
    await expandTheRow();
    /** A strip tile, addressed by its label. */
    const tile = async (label: string) => (await screen.findByText(label)).parentElement!;

    // overallAttainmentPct 71.75 → 72%
    expect((await tile("Overall attainment")).textContent).toContain("72%");
    // estimatedPayout / maxMonthlyEarning — kept paired so the ratio matches 72%.
    const payout = await tile("Estimated payout");
    expect(payout.textContent).toContain("₹10,763");
    expect(payout.textContent).toContain("of ₹15,000 max");
    // kpisOnTrackCount / kpisTotalCount + the engine's own sub-label.
    const onTrack = await tile("KPIs on track");
    expect(onTrack.textContent).toContain("3");
    expect(onTrack.textContent).toContain("4");
    expect(onTrack.textContent).toContain("1 need attention");
    // gatesCount / rolesCoveredCount come from the record too.
    expect((await tile("Gates")).textContent).toContain("1");
    expect((await tile("Roles covered")).textContent).toContain("1");
    // Nothing reads as pending — the record is present.
    expect(screen.queryByText("Awaiting attainment data from the incentive engine.")).toBeNull();
  });

  it("renders one bar per reported KPI, with the engine's % and status tag", async () => {
    await expandTheRow();
    // Scope to the bars card — the donut legend repeats the same labels.
    const card = within(
      (await screen.findByText("KPI-level performance")).closest("div.rounded-2xl") as HTMLElement,
    );
    // Engine codes resolve to catalog display names where one exists…
    expect(card.getByText("Net Sales Value")).toBeInTheDocument();
    // …and are title-cased when the metric has no catalog KPI.
    expect(card.getByText("Attendance")).toBeInTheDocument();
    expect(card.getByText("Effective Coverage")).toBeInTheDocument();
    // Rounded attainment per KPI, including the 0% one.
    expect(card.getByText("95%")).toBeInTheDocument();
    expect(card.getByText("90%")).toBeInTheDocument();
    expect(card.getByText("89%")).toBeInTheDocument();
    expect(card.getByText("0%")).toBeInTheDocument();
    // statusLabel comes straight from the engine.
    expect(card.getAllByText("On track")).toHaveLength(2);
    expect(card.getByText("Watch")).toBeInTheDocument();
    expect(card.getByText("At risk")).toBeInTheDocument();
    // Footer pairs the engine's projected payout with its max.
    expect(card.getByText(/10,763/)).toBeInTheDocument();
  });

  it("splits the donut by the engine's arc shares", async () => {
    await expandTheRow();
    const donut = within(
      (await screen.findByText("KPI-level attainment")).closest("div.rounded-2xl") as HTMLElement,
    );
    // arcSharePct, rounded: 34.61 / 32.93 / 32.46 / 0
    expect(donut.getByText("35%")).toBeInTheDocument();
    expect(donut.getByText("33%")).toBeInTheDocument();
    expect(donut.getByText("32%")).toBeInTheDocument();
    // Centre shows overall attainment until a segment is hovered.
    expect(donut.getByText("72%")).toBeInTheDocument();
    expect(donut.getByText("attained")).toBeInTheDocument();
  });

  it("reads Awaiting data when the engine has no record for the programme", async () => {
    // A DRAFT programme the analytics endpoint hasn't reported on at all.
    vi.mocked(fetchProgramAnalytics).mockResolvedValue([]);
    await expandTheRow();
    await waitFor(() => expect(screen.getAllByText("Awaiting data").length).toBeGreaterThan(0));
    // The KPIs the programme HAS still show (from its rules) — only the attainment
    // figures are unknown, and nothing is invented in their place.
    expect(
      screen.getByText("Awaiting attainment data from the incentive engine."),
    ).toBeInTheDocument();
    expect(screen.queryByText("72%")).toBeNull();
  });

  it("shows the configured KPI list when a record carries an empty breakdown", async () => {
    // The engine's DRAFT records look like this: zeros and kpiPerformanceList: [].
    vi.mocked(fetchProgramAnalytics).mockResolvedValue([
      {
        ...analytics,
        status: "DRAFT",
        overallAttainmentPct: 0,
        estimatedPayout: 0,
        kpisTotalCount: 0,
        kpisOnTrackCount: 0,
        kpiTrackSublabel: "Awaiting data",
        kpiPerformanceList: [],
      },
    ]);
    await expandTheRow();
    expect(
      await screen.findByText("Awaiting attainment data from the incentive engine."),
    ).toBeInTheDocument();
    // The engine's own sub-label is surfaced verbatim rather than reinterpreted.
    expect(screen.getAllByText("Awaiting data").length).toBeGreaterThan(0);
  });
});
