// The KPI catalog is API-only: nothing is bundled, so this hook's states decide
// whether the app shell can render a page at all (see AppLayout). Guards the
// three outcomes — in flight, installed, unavailable.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useKpiCatalog } from "@/components/kpi-library/useKpiCatalog";
import { setKpiCatalog } from "@/components/kpi-library/schema/kpiCatalog";
import { FIXTURE_KPI_METAS, installFixtureKpiCatalog } from "./kpiCatalogFixture";

vi.mock("@/components/kpi-library/schema/kpiConfigApi", () => ({
  fetchKpiSections: vi.fn(),
  fetchKpiVisibility: vi.fn(),
}));
import { fetchKpiSections, fetchKpiVisibility } from "@/components/kpi-library/schema/kpiConfigApi";

function wrapper({ children }: { children: ReactNode }) {
  // retry: false so the "unavailable" case settles immediately.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useKpiCatalog", () => {
  beforeEach(() => {
    // setup.ts pre-installs the fixture catalog; start each case cold instead.
    setKpiCatalog({ entries: {}, templates: [] });
    vi.mocked(fetchKpiVisibility).mockResolvedValue([]);
  });
  afterEach(() => {
    installFixtureKpiCatalog();
    vi.clearAllMocks();
  });

  it("reports loading with an empty catalog until the config lands", async () => {
    vi.mocked(fetchKpiSections).mockReturnValue(new Promise(() => {})); // never settles
    const { result } = renderHook(() => useKpiCatalog(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.templates).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("installs the fetched config as the module-level catalog", async () => {
    vi.mocked(fetchKpiSections).mockResolvedValue(FIXTURE_KPI_METAS);
    vi.mocked(fetchKpiVisibility).mockResolvedValue(["nsv", "sub_db_billing"]);
    const { result } = renderHook(() => useKpiCatalog(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Visibility config orders/limits what the portal shows; `entries` keeps all.
    expect(result.current.templates.map((t) => t.meta.id)).toEqual(["nsv", "sub_db_billing"]);
    expect(Object.keys(result.current.entries).length).toBe(FIXTURE_KPI_METAS.length);
    // The synchronous consumers read the same catalog through getKpiCatalog().
    const { getKpiCatalog, isKpiCatalogLoaded } = await import(
      "@/components/kpi-library/schema/kpiCatalog"
    );
    expect(isKpiCatalogLoaded()).toBe(true);
    expect(getKpiCatalog().entries.nsv).toBeTruthy();
  });

  it("errors — never silently empties — when the config API returns no KPIs", async () => {
    // The fetchers collapse "API failed" and "config missing" into [], and there is
    // no bundled fallback, so this must surface as an error, not an empty library.
    vi.mocked(fetchKpiSections).mockResolvedValue([]);
    const { result } = renderHook(() => useKpiCatalog(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.templates).toEqual([]);
  });
});
