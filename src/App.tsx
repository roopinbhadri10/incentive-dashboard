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
import { PerformancePage } from "@/pages/PerformancePage";
import { RoiPage } from "@/pages/RoiPage";
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
            {/* Campaigns sidebar items reuse the programs list (matches prior behaviour). */}
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
          {/* Catch-all renders its own full-screen layout (no sidebar/header). */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
