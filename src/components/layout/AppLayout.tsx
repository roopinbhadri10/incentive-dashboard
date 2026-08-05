import { useCallback, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { TourProvider } from "@/components/tour/TourContext";
import { TourSpotlight } from "@/components/tour/TourSpotlight";
import { useKpiCatalog } from "@/components/kpi-library/useKpiCatalog";
import { fetchRolePayloadValues, fetchRoleDesignations } from "@/lib/saleshubApi";

/**
 * App shell shared by every in-app route: sidebar + header + the routed page
 * (rendered through <Outlet />). The product tour drives navigation by pushing
 * route paths, and the sidebar highlights the active item from the URL.
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateTo = useCallback((path: string) => navigate(path), [navigate]);

  // Load the KPI catalog from the config API as soon as the app shell mounts.
  // KPIs are API-only (nothing is bundled), and edit / clone rebuild their wizard
  // state synchronously via getKpiCatalog() (see ruleToBuilder), so the routed
  // page is held back until the catalog is in — otherwise those conversions would
  // run against an empty catalog and lose every KPI.
  const kpiCatalog = useKpiCatalog();

  // Warm the role → marketType / designation mappings on app-shell mount too.
  // ruleToBuilder reverse-maps these synchronously to recover the audience role
  // from a rule's applicabilityCriteria (the engine doesn't reliably preserve
  // kpiConfig). Editing from a cold session — before the wizard's own warm-up
  // ran — would otherwise leave the role section empty until a hard refresh.
  useEffect(() => {
    fetchRolePayloadValues().catch(() => { /* non-fatal */ });
    fetchRoleDesignations().catch(() => { /* non-fatal */ });
  }, []);

  return (
    <TourProvider onNavigate={navigateTo}>
      <div className="flex h-screen overflow-hidden app-canvas">
        <AppSidebar currentView={location.pathname} onNavigate={navigateTo} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader currentView={location.pathname} onNavigate={navigateTo} />
          <main className="flex-1 overflow-hidden flex flex-col">
            {kpiCatalog.isLoading ? (
              <CatalogLoading />
            ) : kpiCatalog.isError ? (
              <CatalogUnavailable onRetry={kpiCatalog.refetch} />
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
      <TourSpotlight />
    </TourProvider>
  );
}

/** Shown in the page area while the KPI configuration is being fetched. */
function CatalogLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading KPI configuration…
      </div>
    </div>
  );
}

/**
 * Shown when the config API can't supply the catalogue. There is no bundled
 * fallback by design, so the page area stays blocked rather than pretending the
 * tenant has no KPIs.
 */
function CatalogUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="max-w-md text-center space-y-3">
        <AlertTriangle size={20} className="mx-auto text-destructive" />
        <h2 className="text-sm font-semibold text-foreground">KPI configuration unavailable</h2>
        <p className="text-xs text-muted-foreground">
          The KPI catalogue is served by the incentive config API
          (incentiveconfig / kpi_section_configuration). Nothing is bundled with the app, so
          programmes can't be viewed or built until that config loads.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}
