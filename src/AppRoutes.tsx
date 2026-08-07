import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProgramsRoute } from "@/routes/ProgramsRoute";
import { ProgramAnalyticsRoute } from "@/routes/ProgramAnalyticsRoute";
import { CreateHubRoute } from "@/routes/CreateHubRoute";
import { WizardRoute } from "@/routes/WizardRoute";
import { QuickCloneRoute } from "@/routes/QuickCloneRoute";
import { KpiLibraryPage } from "@/pages/KpiLibraryPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { UsersListPage } from "@/pages/UsersListPage";
import { PerformancePage } from "@/pages/PerformancePage";
import { RoiPage } from "@/pages/RoiPage";
import NotFound from "@/pages/NotFound";

/** The route tree shared by the standalone app (BrowserRouter) and the plugin
 *  build (MemoryRouter). Keep in sync with SLUG_TO_VIEW. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/programs" replace />} />
        <Route path="/programs" element={<ProgramsRoute />} />
        <Route path="/programs/:id/analytics" element={<ProgramAnalyticsRoute />} />
        <Route path="/campaigns/active" element={<ProgramsRoute />} />
        <Route path="/campaigns/completed" element={<ProgramsRoute />} />
        <Route path="/campaigns/drafts" element={<ProgramsRoute />} />
        <Route path="/create" element={<CreateHubRoute />} />
        <Route path="/create/wizard" element={<WizardRoute />} />
        <Route path="/clone/quick-review" element={<QuickCloneRoute />} />
        <Route path="/kpi-library" element={<KpiLibraryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users" element={<UsersListPage />} />
        <Route path="/analytics/performance" element={<PerformancePage />} />
        <Route path="/analytics/roi" element={<RoiPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
