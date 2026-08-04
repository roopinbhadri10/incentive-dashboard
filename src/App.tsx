import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProgramsRoute } from "@/routes/ProgramsRoute";
import { ProgramAnalyticsRoute } from "@/routes/ProgramAnalyticsRoute";
import { CreateHubRoute } from "@/routes/CreateHubRoute";
import { WizardRoute } from "@/routes/WizardRoute";
import { QuickCloneRoute } from "@/routes/QuickCloneRoute";
import { KpiLibraryPage } from "@/pages/KpiLibraryPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { UsersListPage } from "@/pages/UsersListPage";
import { UsersDirectoryPage } from "@/pages/UsersDirectoryPage";
import { PayoutManagementPage } from "@/pages/PayoutManagementPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/programs" replace />} />
            <Route path="/programs" element={<ProgramsRoute />} />
            <Route path="/programs/:id/analytics" element={<ProgramAnalyticsRoute />} />
            {/* Campaigns sidebar items are the programmes list filtered by status;
                the :status segment drives the list's status filter. */}
            <Route path="/campaigns/:status" element={<ProgramsRoute />} />
            {/* Legacy plural path from the earlier nav. */}
            <Route path="/campaigns/drafts" element={<Navigate to="/campaigns/draft" replace />} />
            <Route path="/create" element={<CreateHubRoute />} />
            <Route path="/create/wizard" element={<WizardRoute />} />
            <Route path="/clone/quick-review" element={<QuickCloneRoute />} />
            <Route path="/kpi-library" element={<KpiLibraryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/payout-management" element={<PayoutManagementPage />} />
            <Route path="/users" element={<UsersListPage />} />
            <Route path="/users-directory" element={<UsersDirectoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            {/* Legacy analytics deep links now resolve to the unified page. */}
            <Route path="/analytics/performance" element={<Navigate to="/analytics" replace />} />
            <Route path="/analytics/cohort" element={<Navigate to="/analytics" replace />} />
            <Route path="/analytics/roi" element={<Navigate to="/analytics" replace />} />
          </Route>
          {/* Catch-all renders its own full-screen layout (no sidebar/header). */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
