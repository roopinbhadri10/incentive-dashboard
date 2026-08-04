import { PlayCircle, Plus } from "lucide-react";
import { useTour } from "@/components/tour/TourContext";
import { ShimmerChip } from "@/components/ui/shimmer-chip";

/** Route path → page title shown at the top-left of the header. */
const viewTitles: Record<string, string> = {
  "/programs": "",
  "/create": "Create a programme",
  "/create/wizard": "Create a programme",
  "/clone/quick-review": "Quick clone review",
  "/kpi-library": "KPI library",
  "/reports": "Reports",
  "/payout-management": "Payout management",
  "/users": "Users list",
  "/users-directory": "Users directory",
  "/analytics": "Analytics",
};

interface AppHeaderProps {
  currentView?: string;
  onNavigate?: (view: string) => void;
}

export function AppHeader({ currentView = "/programs", onNavigate }: AppHeaderProps) {
  const { start } = useTour();

  // Dynamic paths can't be plain map keys. The programmes list renders its own
  // heading, so every /campaigns/:status view leaves the header title blank.
  const title =
    viewTitles[currentView] ??
    (/^\/campaigns\//.test(currentView)
      ? ""
      : /^\/programs\/[^/]+\/analytics$/.test(currentView)
      ? "Programme analytics"
      : "Salescode Studio");
  const showCreate = currentView === "/programs";

  return (
    <header className="h-16 flex items-center justify-between px-6 shrink-0 bg-transparent">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">{title}</h2>
        </div>
        <ShimmerChip badge="LIVE" label="Incentive Engine is ready to use" className="hidden lg:inline-flex" />
      </div>

      <div className="flex items-center gap-2" data-tour="theme-toggle">
        <button
          onClick={start}
          className="relative flex items-center gap-2 overflow-hidden rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <span className="shimmer-sweep absolute inset-0 pointer-events-none" aria-hidden />
          <PlayCircle size={16} className="relative" />
          <span className="relative">
            30 sec <strong className="font-semibold">Quick Guide</strong>
          </span>
        </button>

        {showCreate && onNavigate && (
          <button
            onClick={() => onNavigate("/create/wizard")}
            className="ml-1 flex items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-2 text-sm font-medium text-primary hover:bg-sidebar-accent transition-colors"
          >
            <Plus size={16} />
            New programme
          </button>
        )}
      </div>
    </header>
  );
}
