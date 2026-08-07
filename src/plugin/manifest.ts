import type { BundleManifest } from "@/plugin/shell-types";

// Sidebar mirrors the standalone app's AppSidebar
// (src/components/layout/AppSidebar.tsx), expressed in the SHELL's own sidebar
// shape rather than the standalone one's.
//
// The standalone rail nests everything under one unlabelled group as accordion
// items (`_campaigns`, `_create`, `_analytics`) with `children`. That renders as
// a second, plugin-shaped hierarchy inside the shell's sidebar — nested rows
// that don't look like any other product's. So each of those sections is a shell
// GROUP here and its sub-tabs are that group's ITEMS, which is what every other
// bundle does (SFA: sfa-self-serve src/plugin/lib/sidebar-config.ts; DMS folds
// its top navbar in the same way) and what the shell styles as group header +
// item rows.
//
// Every slug below is navigable and MUST appear in SLUG_TO_VIEW — there are no
// non-navigating parents left. All icons exist in the shell's ICON_MAP; an icon
// name that isn't a key there renders nothing at all, including in the collapsed
// rail, so don't invent names.
export const manifest: BundleManifest = {
  id: "plugin-incentive",
  name: "Sales Incentive",
  version: "1.0.0",
  defaultSidebarSlug: "programs",
  sidebar: [
    {
      group: "CAMPAIGNS",
      groupLabel: "Campaigns",
      icon: "target",
      items: [
        { slug: "programs", name: "Active", icon: "rocket" },
        { slug: "campaigns-completed", name: "Completed", icon: "trophy" },
        { slug: "campaigns-drafts", name: "Drafts", icon: "clipboard-list" },
      ],
    },
    {
      group: "CREATE",
      groupLabel: "Create",
      icon: "plus",
      items: [
        { slug: "clone-programs", name: "Clone programs", icon: "grid" },
        { slug: "wizard", name: "Create new", icon: "sparkles" },
      ],
    },
    {
      group: "ANALYTICS",
      groupLabel: "Analytics",
      icon: "bar-chart-3",
      items: [
        { slug: "performance", name: "Performance", icon: "trending-up" },
        { slug: "roi", name: "ROI Analysis", icon: "banknote" },
      ],
    },
    {
      // Trailing utility items — an empty groupLabel renders them as bare rows
      // with no group header, the same treatment SFA's "MAIN" group gets.
      group: "MAIN",
      groupLabel: "",
      items: [
        { slug: "reports", name: "Reports", icon: "file-text" },
        { slug: "users", name: "Users List", icon: "users" },
      ],
    },
  ],
};

// Every item is a navigable leaf now that the accordion parents are gone. The
// `children` branch is kept so re-introducing a nested item can't silently drop
// its slugs out of this list.
export const NAV_SLUGS: string[] = manifest.sidebar.flatMap((g) =>
  g.items.flatMap((i) => (i.children ? i.children.map((c) => c.slug) : [i.slug])),
);
