import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Mic,
  Plus,
  Search,
  Target,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: { label: string; href: string }[];
}

const sidebarItems: SidebarItem[] = [
  {
    label: "Campaigns",
    icon: <Target size={18} />,
    children: [
      // Mirrors the Programmes list "All statuses" filter, one entry per status.
      { label: "All", href: "/campaigns/all" },
      { label: "Active", href: "/campaigns/active" },
      { label: "Scheduled", href: "/campaigns/scheduled" },
      { label: "Draft", href: "/campaigns/draft" },
      { label: "Completed", href: "/campaigns/completed" },
      { label: "Archived", href: "/campaigns/inactive" },
    ],
  },
  {
    label: "Create",
    icon: <Plus size={18} />,
    children: [
      { label: "Clone programs", href: "/programs" },
      { label: "Create new", href: "/create/wizard" },
    ],
  },
  {
    label: "Analytics",
    icon: <BarChart3 size={18} />,
    href: "/analytics",
  },
  {
    label: "Payout Management",
    icon: <Wallet size={18} />,
    href: "/payout-management",
  },
  {
    label: "Users List",
    icon: <Users size={18} />,
    href: "/users",
  },
  {
    label: "Users Directory",
    icon: <Search size={18} />,
    href: "/users-directory",
  },
];

interface AppSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

/** Groups holding the current route, so they open on load / deep link. */
function groupsFor(view: string): string[] {
  return sidebarItems
    .filter((i) => i.children?.some((c) => c.href === view))
    .map((i) => i.label);
}

export function AppSidebar({ currentView, onNavigate }: AppSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const active = groupsFor(currentView);
    return active.length > 0 ? active : ["Create"];
  });
  const [collapsed, setCollapsed] = useState(false);

  // Landing on (or deep-linking to) a child route reveals its group, so the
  // selected item is always visible. Never auto-collapses — a group the user
  // closed by hand stays closed.
  useEffect(() => {
    const active = groupsFor(currentView);
    if (active.length === 0) return;
    setExpandedItems((prev) =>
      active.every((l) => prev.includes(l)) ? prev : [...prev, ...active.filter((l) => !prev.includes(l))]
    );
  }, [currentView]);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const isChildActive = (item: SidebarItem) =>
    item.children?.some((c) => c.href === currentView);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen shrink-0 bg-sidebar border-r border-sidebar-border transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Workspace switcher */}
      <div className="px-3 py-4 flex items-center gap-2" data-tour="logo">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Zap size={18} className="text-primary-foreground" />
        </div>
        {!collapsed && (
          <button className="flex-1 min-w-0 flex items-center gap-1 text-left">
            <span className="truncate text-[15px] font-semibold text-sidebar-foreground">
              Incentive Engine
            </span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          </button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors shrink-0"
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 overflow-y-auto space-y-0.5">
        {sidebarItems.map((item) => {
          const active =
            (!item.children && currentView === item.href) || !!isChildActive(item);
          const row = (
            <button
              onClick={() => {
                if (item.children) {
                  if (collapsed) setCollapsed(false);
                  toggleExpand(item.label);
                } else if (item.href) {
                  onNavigate(item.href);
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-active text-sidebar-active-foreground font-semibold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span className={cn(active && "text-sidebar-active-foreground")}>
                {item.icon}
              </span>
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && item.children && (
                expandedItems.includes(item.label) ? (
                  <ChevronDown size={14} className="opacity-60" />
                ) : (
                  <ChevronRight size={14} className="opacity-60" />
                )
              )}
            </button>
          );

          return (
            <div key={item.label} data-tour={`nav-${item.label.toLowerCase()}`}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{row}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                row
              )}
              {!collapsed && item.children && expandedItems.includes(item.label) && (
                <div className="mt-0.5 mb-1 ml-6 pl-3 border-l border-sidebar-border space-y-0.5">
                  {item.children.map((child) => (
                    <button
                      key={child.label}
                      onClick={() => onNavigate(child.href)}
                      className={cn(
                        "w-full text-left rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                        currentView === child.href
                          ? "bg-sidebar-active text-sidebar-active-foreground font-semibold"
                          : "text-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3">
        <button
          className={cn(
            "w-full flex items-center gap-2 rounded-full border border-primary/40 text-primary text-sm font-medium py-2 hover:bg-sidebar-accent transition-colors",
            collapsed ? "justify-center px-0" : "justify-center px-3"
          )}
        >
          <Mic size={15} />
          {!collapsed && <span>Live Help</span>}
        </button>
      </div>
    </aside>
  );
}
