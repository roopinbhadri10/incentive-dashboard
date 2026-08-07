// Minimal local mirror of the Salescode shell's plugin contract
// (SHELL: src/lib/plugins/types.ts). Kept in-repo so the plugin bundle has no
// build-time dependency on the shell. Only the fields this plugin uses are
// included; extend as needed.

export interface BundleSidebarChildItem {
  slug: string;
  name: string;
  navigateToSlug?: string;
}

export interface BundleSidebarItem {
  slug: string;
  name: string;
  icon: string;
  badge?: "warning" | "demo" | null;
  children?: BundleSidebarChildItem[];
  navigateToSlug?: string;
  comingSoon?: boolean;
}

export interface BundleSidebarGroup {
  group: string;
  groupLabel: string;
  icon?: string;
  navigateToSlug?: string;
  items: BundleSidebarItem[];
}

export interface BundleManifest {
  id: string;
  name: string;
  version: string;
  sidebar: BundleSidebarGroup[];
  defaultSidebarSlug?: string;
  logo?: string;
}

export interface ShellContext {
  user: { name: string; email: string; leadId: string } | null;
  theme: "light" | "dark";
  sidebar: { slug: string };
  product: { slug: string; id: string };
  /** The product slug that owns this mounted bundle. With keep-alive several
   *  bundles stay mounted at once; compare against the `shell:active-bundle`
   *  event's `ownerProductSlug` to know when THIS bundle is the active one. */
  ownerProductSlug?: string;
  updateSidebar: (groups: BundleSidebarGroup[] | null) => void;
  navigate?: (slug: string) => void;
  track?: (event: string, properties?: Record<string, unknown>) => void;
  /**
   * Top NavBar portal slots — DOM elements the shell exposes so the plugin can
   * render its own title / actions into the shell's top bar. `slots.*` can be
   * null on first mount until the shell's NavBar commits its refs; subscribe to
   * `shell:navbar-slots` on `window` (detail `{ productSlug, slots }`) for
   * updates. `registerHole` lets shell-side widgets (the Apps picker) portal
   * back into a hole the plugin declares.
   */
  navBar?: {
    slots: {
      left: HTMLElement | null;
      center: HTMLElement | null;
      right: HTMLElement | null;
    };
    setUseFullSlot?: (value: boolean) => void;
    setChromeStyle?: (style: import("react").CSSProperties | null) => void;
    registerHole?: (name: string, el: HTMLElement) => void;
    unregisterHole?: (name: string) => void;
  };
}
