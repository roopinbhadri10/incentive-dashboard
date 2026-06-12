import { useState, useEffect } from "react";
import { Bell, Moon, Sun, MoreVertical, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/tour/TourContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      <div className="flex items-center gap-1.5" data-tour="theme-toggle">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={start}
              aria-label="Replay product tour"
            >
              <HelpCircle size={16} className="text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Replay product tour</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDark((d) => !d)}
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
          RS
        </div>
      </div>
    </header>
  );
}

