import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export interface TourStep {
  id: string;
  /** CSS selector of the element to highlight. */
  selector: string;
  title: string;
  body: string;
  /** Which view the step belongs to — the tour will navigate there before showing. */
  view: string;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    selector: '[data-tour="logo"]',
    title: "Welcome to Salescode.ai 👋",
    body: "Let's take a 60-second tour of your incentive engine. You can replay this anytime from the help icon in the top bar.",
    view: "/programs",
    placement: "right",
  },
  {
    id: "campaigns",
    selector: '[data-tour="nav-campaigns"]',
    title: "Campaigns",
    body: "All your active, completed, and draft incentive programs in one place — with attainment, payouts and KPI breakdown per program.",
    view: "/programs",
    placement: "right",
  },
  {
    id: "create",
    selector: '[data-tour="nav-create"]',
    title: "Create new programs",
    body: "Three ways to launch: a guided wizard, clone an existing winner, or start from a recommended template.",
    view: "/programs",
    placement: "right",
  },
  {
    id: "analytics",
    selector: '[data-tour="nav-analytics"]',
    title: "Analytics",
    body: "Track Performance (attainment, KPIs, leaderboards) and ROI Analysis (incremental sales, payout efficiency, budget burn) in real time.",
    view: "/programs",
    placement: "right",
  },
  {
    id: "filters",
    selector: '[data-tour="program-filters"]',
    title: "Filter & search",
    body: "Slice your programs by region, channel, user type or date range. Search by program name or code instantly.",
    view: "/programs",
    placement: "bottom",
  },
  {
    id: "program-row",
    selector: '[data-tour="program-row"]',
    title: "Program details",
    body: "Click any program to expand its full detail — KPIs with attainment, the KPI × tier payout matrix, and lifetime metrics.",
    view: "/programs",
    placement: "top",
  },
  {
    id: "performance",
    selector: '[data-tour="performance-page"]',
    title: "Performance dashboard",
    body: "Topline KPIs, attainment trend, KPI heatmap and rep leaderboards — everything you need for your weekly review.",
    view: "/analytics/performance",
    placement: "auto",
  },
  {
    id: "roi",
    selector: '[data-tour="roi-page"]',
    title: "ROI Analysis",
    body: "See blended ROI, payout-vs-return scatter, budget burn and a period-end forecast. Reallocate budget where it works hardest.",
    view: "/analytics/roi",
    placement: "auto",
  },
  {
    id: "theme",
    selector: '[data-tour="theme-toggle"]',
    title: "Theme & guide",
    body: "Toggle dark/light mode here. Need a refresher? Click the help icon next to it to replay this tour anytime.",
    view: "/programs",
    placement: "bottom",
  },
];

interface TourContextValue {
  isActive: boolean;
  stepIndex: number;
  currentStep: TourStep | null;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  goToStep: (i: number) => void;
  totalSteps: number;
}

const TourContext = createContext<TourContextValue | null>(null);

const STORAGE_KEY = "salescode-tour-completed";

interface TourProviderProps {
  children: ReactNode;
  onNavigate: (view: string) => void;
}

export function TourProvider({ children, onNavigate }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Auto-start on first visit
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay so layout settles
      const t = setTimeout(() => setIsActive(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Navigate to the right view as steps change
  useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[stepIndex];
    if (step) onNavigate(step.view);
  }, [isActive, stepIndex, onNavigate]);

  const start = useCallback(() => {
    setStepIndex(0);
    setIsActive(true);
  }, []);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setIsActive(false);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= TOUR_STEPS.length - 1) {
        finish();
        return 0;
      }
      return i + 1;
    });
  }, [finish]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const goToStep = useCallback((i: number) => {
    setStepIndex(Math.max(0, Math.min(TOUR_STEPS.length - 1, i)));
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      stepIndex,
      currentStep: isActive ? TOUR_STEPS[stepIndex] ?? null : null,
      start,
      next,
      prev,
      skip,
      goToStep,
      totalSteps: TOUR_STEPS.length,
    }),
    [isActive, stepIndex, start, next, prev, skip, goToStep],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
