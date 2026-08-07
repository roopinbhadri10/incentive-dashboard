import { useState, useEffect } from "react";
import { Bell, Moon, Sun, MoreVertical, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/tour/TourContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AppHeaderActionsProps {
  dark: boolean;
  onToggleDark: () => void;
  /** Initials shown in the avatar bubble. */
  initials?: string;
  /** Omit to hide the replay-tour button. */
  onReplayTour?: () => void;
}

/**
 * The header's action cluster, split out so the plugin build can portal the
 * same controls into the Salescode shell's top NavBar (see
 * src/plugin/NavBarPortal.tsx) instead of rendering our own <header>.
 * Presentational only — dark mode is owned by the caller, because standalone
 * toggles <html class="dark"> while the plugin toggles its mount wrapper.
 */
export function AppHeaderActions({
  dark,
  onToggleDark,
  initials = "RS",
  onReplayTour,
}: AppHeaderActionsProps) {
  return (
    <div className="flex items-center gap-1.5" data-tour="theme-toggle">
      {onReplayTour && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onReplayTour}
              aria-label="Replay product tour"
            >
              <HelpCircle size={16} className="text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Replay product tour</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleDark}
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={16} className="text-muted-foreground" /> : <Moon size={16} className="text-muted-foreground" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{dark ? "Light mode" : "Dark mode"}</TooltipContent>
      </Tooltip>
      <Bell size={18} className="text-muted-foreground cursor-pointer hover:text-foreground ml-2" />
      <MoreVertical size={18} className="text-muted-foreground cursor-pointer hover:text-foreground" />
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold ml-1">
        {initials}
      </div>
    </div>
  );
}

export function AppHeader() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const { start } = useTour();

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div />
      <AppHeaderActions
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        onReplayTour={start}
      />
    </header>
  );
}
