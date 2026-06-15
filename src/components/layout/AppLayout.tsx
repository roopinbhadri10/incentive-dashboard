import { useCallback, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
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

  // Warm the KPI catalog from the API as soon as the app shell mounts. Edit /
  // clone rebuild their wizard state synchronously via getKpiCatalog() (see
  // ruleToBuilder); without this the first such build before the catalog loads
  // would fall back to the bundled dummy defaults instead of the live config.
  useKpiCatalog();

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
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar currentView={location.pathname} onNavigate={navigateTo} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-hidden flex flex-col">
            <Outlet />
          </main>
        </div>
      </div>
      <TourSpotlight />
    </TourProvider>
  );
}
