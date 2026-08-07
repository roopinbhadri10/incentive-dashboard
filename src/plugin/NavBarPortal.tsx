import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import type { ShellContext } from "@/plugin/shell-types";
import { titleForPath } from "@/plugin/navbar-title";
import { usePluginTheme } from "@/plugin/plugin-theme";

/**
 * Wraps content portaled into the shell NavBar slots with the plugin's
 * `.incentive-scope` class so the prefix-scoped Tailwind rules resolve, and
 * mirrors the `dark` class (driven by the shell's `shell:theme-changed` and by
 * our own header toggle — both go through plugin-theme).
 */
function ScopedPortalContent({ children }: { children: React.ReactNode }) {
  const theme = usePluginTheme();

  // display:contents so this wrapper never affects navbar layout. Set inline
  // (not the Tailwind `contents` class) because that class is itself scoped
  // `.incentive-scope .contents`, which wouldn't match this wrapper (it IS the
  // scope root).
  return (
    <div
      className={`incentive-scope${theme === "dark" ? " dark" : ""}`}
      style={{ display: "contents" }}
    >
      {children}
    </div>
  );
}

// The shell's navbar chrome div sits outside `.incentive-scope`, so our CSS
// variables can't reach it. These literals are the `--card` token from
// src/index.css — the same surface the standalone <AppHeader> uses via `bg-card`.
// Height, padding and the bottom hairline stay shell-owned (they live on
// sibling/parent elements chromeStyle doesn't reach — see SHELL
// src/components/nav-bar/components/NavBar.tsx).
const CHROME_BG = { light: "hsl(0 0% 100%)", dark: "hsl(200 12% 10%)" } as const;

/**
 * Renders the plugin's title into the shell NavBar left slot and declares the
 * `navbar.right.actions` hole in the right slot so shell-side widgets (the Apps
 * picker) have somewhere to portal. Without this the shell's top bar is empty
 * for this plugin. Must render inside the plugin's Router (uses useLocation).
 */
export function NavBarPortal({ ctx }: { ctx: ShellContext }) {
  const location = useLocation();
  const theme = usePluginTheme();
  const navBarTitle = titleForPath(location.pathname);

  // Seeded from ctx at mount; refreshed when the shell re-emits its slot DOM
  // refs (they can be null until the shell's NavBar commits its refs).
  const [slots, setSlots] = useState(ctx.navBar?.slots);
  useEffect(() => {
    const onSlotsChanged = (e: Event) => {
      const detail = (e as CustomEvent<{
        productSlug?: string;
        slots?: NonNullable<ShellContext["navBar"]>["slots"];
      }>).detail;
      if (!detail?.slots) return;
      if (detail.productSlug && detail.productSlug !== ctx.product.slug) return;
      setSlots(detail.slots);
    };
    window.addEventListener("shell:navbar-slots", onSlotsChanged);
    return () => window.removeEventListener("shell:navbar-slots", onSlotsChanged);
  }, [ctx.product.slug]);

  // With keep-alive several bundles stay mounted; only the active one may paint
  // the shared navbar. A bundle is active when first mounted.
  const [isActive, setIsActive] = useState(true);
  useEffect(() => {
    const owner = ctx.ownerProductSlug ?? ctx.product.slug;
    const onActive = (e: Event) => {
      const detail = (e as CustomEvent<{ ownerProductSlug?: string }>).detail;
      if (!detail) return;
      setIsActive(detail.ownerProductSlug === owner);
    };
    window.addEventListener("shell:active-bundle", onActive);
    return () => window.removeEventListener("shell:active-bundle", onActive);
  }, [ctx.ownerProductSlug, ctx.product.slug]);

  // Shell-side action widgets (Apps icon, …) portal into this hole.
  const actionsHoleRef = useCallback(
    (el: HTMLDivElement | null) => {
      const navBar = ctx.navBar;
      if (!navBar?.registerHole || !navBar?.unregisterHole) return;
      if (el) navBar.registerHole("navbar.right.actions", el);
      else navBar.unregisterHole("navbar.right.actions");
    },
    [ctx.navBar],
  );

  // Dress the shell navbar as the standalone <AppHeader> surface (`bg-card`).
  //
  // The vertical padding is what sets the bar's height: the shell's own row is
  // a fixed `min-h-10` + `pt-1`, and chromeStyle's padding is the only part a
  // plugin can add to it. `0.75rem` top/bottom is the SFA plugin's value (see
  // sfa-self-serve src/plugin/PluginApp.tsx) — keep the two in sync so
  // switching products doesn't change the top bar's height.
  useEffect(() => {
    if (!isActive) return;
    ctx.navBar?.setChromeStyle?.({
      background: CHROME_BG[theme],
      boxShadow: "none",
      paddingTop: "0.75rem",
      paddingBottom: "0.75rem",
    });
  }, [ctx.navBar, isActive, theme]);

  if (!isActive) return null;

  return (
    <>
      {slots?.left &&
        createPortal(
          <ScopedPortalContent>
            <h1
              className="truncate text-lg sm:text-xl font-semibold text-foreground"
              style={{ margin: 0 }}
            >
              {navBarTitle}
            </h1>
          </ScopedPortalContent>,
          slots.left,
        )}
      {slots?.right &&
        createPortal(
          /* The standalone <AppHeader> action cluster is NOT mirrored here. Every
             control in it is either duplicate or dead inside the shell: the
             replay-tour "info" button, the dark-mode toggle (the shell's sidebar
             footer owns theme and broadcasts `shell:theme-changed`), the
             notification bell and the overflow menu (no plugin-side
             destination), and the avatar (the shell's own account menu). Only
             the shell's widget hole is left, so the right side of the bar is
             shell chrome alone.

             The hole lives OUTSIDE .incentive-scope so shell-contributed widgets
             aren't restyled by the plugin's scoped CSS preflight. */
          <div
            ref={actionsHoleRef}
            data-navbar-hole="navbar.right.actions"
            className="inline-flex items-center gap-2 ml-2 mr-2"
          />,
          slots.right,
        )}
    </>
  );
}
