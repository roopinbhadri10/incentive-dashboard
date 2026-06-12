import { useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { TourProvider } from "@/components/tour/TourContext";
import { TourSpotlight } from "@/components/tour/TourSpotlight";

/**
 * App shell shared by every in-app route: sidebar + header + the routed page
 * (rendered through <Outlet />). The product tour drives navigation by pushing
 * route paths, and the sidebar highlights the active item from the URL.
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateTo = useCallback((path: string) => navigate(path), [navigate]);

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
