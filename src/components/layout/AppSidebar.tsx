import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileDown,
  HelpCircle,
  Import,
  Library,
  Plus,
  Target,
  Users,
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
      { label: "Active", href: "/campaigns/active" },
      { label: "Completed", href: "/campaigns/completed" },
      { label: "Drafts", href: "/campaigns/drafts" },
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
    children: [
      { label: "Performance", href: "/analytics/performance" },
      { label: "ROI Analysis", href: "/analytics/roi" },
    ],
  },
  {
    label: "Reports",
    icon: <FileDown size={18} />,
    href: "/reports",
  },
  {
    label: "Users List",
    icon: <Users size={18} />,
    href: "/users",
  },
];

interface AppSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function AppSidebar({ currentView, onNavigate }: AppSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>(["Create"]);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((i) => i !== label)
        : [...prev, label]
    );
  };

  const isChildActive = (item: SidebarItem) => {
    return item.children?.some((c) => c.href === currentView);
  };

  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col h-screen shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-border" data-tour="logo">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap size={18} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">Salescode.ai</h1>
            <p className="text-[10px] text-muted-foreground">Incentive Engine</p>
          </div>
        </div>
      </div>


      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {sidebarItems.map((item) => (
          <div key={item.label} data-tour={`nav-${item.label.toLowerCase()}`}>
            <button
              onClick={() => {
                if (item.children) {
                  toggleExpand(item.label);
                } else if (item.href) {
                  onNavigate(item.href);
                }
              }}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors",
                !item.children && currentView === item.href && "border-l-[3px] border-primary text-primary font-semibold bg-sidebar-accent",
                item.children && isChildActive(item) && "text-foreground font-medium"
              )}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.children && (
                expandedItems.includes(item.label) ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              )}
            </button>
            {item.children && expandedItems.includes(item.label) && (
              <div className="ml-6 border-l border-border">
                {item.children.map((child) => (
                  <button
                    key={child.label}
                    onClick={() => onNavigate(child.href)}
                    className={cn(
                      "w-full text-left px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
                      currentView === child.href && "text-primary font-semibold border-l-[3px] border-primary -ml-px bg-sidebar-accent"
                    )}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
