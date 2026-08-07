// ============================================
// Plugin theme store
// ============================================
// Standalone, dark mode is `<html class="dark">`. Inside the shell we must never
// touch the host document, so the `dark` class lives on our mount wrapper (and
// on body-level portals, which are re-parented outside it).
//
// plugin-entry.tsx owns the wrapper and seeds this store, and feeds the shell's
// own theme changes in through setPluginTheme on `shell:theme-changed`.
// NavBarPortal only READS it (for the scope class + navbar background): the
// header's Sun/Moon toggle isn't rendered in plugin mode, because the shell's
// sidebar footer owns the theme switch. `requestPluginTheme` /
// `togglePluginTheme` below are therefore the standalone-side / re-entry API
// with no in-shell caller today.

import { useEffect, useState } from "react";

export type PluginTheme = "light" | "dark";

const SCOPE_CLASS = "incentive-scope";

let current: PluginTheme = "light";
let wrapper: HTMLElement | null = null;
const listeners = new Set<(theme: PluginTheme) => void>();

function apply(): void {
  if (wrapper) {
    wrapper.className = `${SCOPE_CLASS}${current === "dark" ? " dark" : ""}`;
  }
  // Keep body-level portals (Radix, sonner) in sync — they carry the scope class
  // but live outside the wrapper, so they don't inherit its `dark`.
  document.querySelectorAll<HTMLElement>(`body > .${SCOPE_CLASS}`).forEach((el) => {
    if (el === wrapper) return;
    el.classList.toggle("dark", current === "dark");
  });
}

/** Called by mount(): binds the wrapper and applies the shell's initial theme. */
export function initPluginTheme(el: HTMLElement, theme: PluginTheme): void {
  wrapper = el;
  current = theme;
  apply();
}

/** Called by unmount(). */
export function disposePluginTheme(el: HTMLElement): void {
  if (wrapper === el) wrapper = null;
}

export function getPluginTheme(): PluginTheme {
  return current;
}

export function setPluginTheme(theme: PluginTheme): void {
  if (theme === current) {
    // Still re-apply: a newly opened portal may need the class.
    apply();
    return;
  }
  current = theme;
  apply();
  listeners.forEach((fn) => fn(current));
}

/**
 * Theme change requested from INSIDE the plugin (the header's Sun/Moon button).
 *
 * `setPluginTheme` alone only re-themes what lives under `.incentive-scope` —
 * the mount wrapper and our body-level portals. The shell's own chrome (sidebar,
 * nav bar, page canvas) is outside that scope and reads `<html class="dark">`,
 * so a local-only toggle leaves half the screen on the old theme.
 *
 * The shell both dispatches AND listens to `shell:theme-changed` for exactly
 * this case (see SHELL src/components/dashboard/DashboardShell.tsx): it adopts an
 * inbound value into its saved preference, applies it to <html>, and re-emits.
 * That echo lands back in plugin-entry's handler as a no-op, because we've
 * already applied it locally here for instant feedback.
 *
 * On shell routes with a forced theme the inbound value is ignored by design, so
 * the plugin re-themes on its own — same behaviour as the other plugins that use
 * this channel.
 */
export function requestPluginTheme(theme: PluginTheme): void {
  setPluginTheme(theme);
  window.dispatchEvent(new CustomEvent("shell:theme-changed", { detail: { theme } }));
}

export function togglePluginTheme(): void {
  requestPluginTheme(current === "dark" ? "light" : "dark");
}

/** Re-apply the current theme (used by the portal MutationObserver). */
export function reapplyPluginTheme(): void {
  apply();
}

/** React binding for the current plugin theme. */
export function usePluginTheme(): PluginTheme {
  const [theme, setTheme] = useState<PluginTheme>(current);
  useEffect(() => {
    listeners.add(setTheme);
    setTheme(current);
    return () => {
      listeners.delete(setTheme);
    };
  }, []);
  return theme;
}
