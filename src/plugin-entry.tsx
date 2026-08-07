// ============================================
// Incentive Engine Plugin Entry — Shell Bundle Contract
// ============================================
// The ONLY entry point for the plugin build (vite.plugin.config.ts).
// Built via: npm run build:plugin → dist-plugin/incentive-plugin.[hash].js
//
// The shell expects exactly three named exports: manifest, mount(), unmount().

import ReactDOM from "react-dom/client";
import PluginApp from "@/PluginApp";
import { manifest } from "@/plugin/manifest";
import type { ShellContext } from "@/plugin/shell-types";
import {
  disposePluginTheme,
  initPluginTheme,
  reapplyPluginTheme,
  setPluginTheme,
} from "@/plugin/plugin-theme";
import "@/index.css";

export { manifest };

export type MountReturn = {
  root: ReturnType<typeof ReactDOM.createRoot>;
  wrapper: HTMLDivElement;
  themeHandler: (e: Event) => void;
  portalObserver: MutationObserver;
};

/** Called by the shell when the user opens this product. */
export function mount(container: HTMLElement, ctx: ShellContext): MountReturn {
  // CSS-scope + theme root. All plugin styles are prefixed with
  // `.incentive-scope` at build time; the app renders inside this wrapper.
  const wrapper = document.createElement("div");
  wrapper.style.height = "100%";

  // The `dark` class + portal sync live in plugin-theme so the header's theme
  // toggle (portaled into the shell NavBar) can drive them too.
  initPluginTheme(wrapper, ctx.theme ?? "light");
  container.appendChild(wrapper);

  // Auto-scope Radix/sonner portals that render directly into document.body.
  // Without `.incentive-scope` on the portal root, the prefix-scoped Tailwind
  // CSS does not apply and portals render unstyled.
  const portalObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node === wrapper) return;
        if (node.parentElement !== document.body) return;
        if (node.classList.contains("incentive-scope")) return;
        node.classList.add("incentive-scope");
        reapplyPluginTheme();
      });
    }
  });
  portalObserver.observe(document.body, { childList: true });

  // Follow the shell's theme changes.
  const themeHandler = (e: Event) => {
    const t = (e as CustomEvent).detail?.theme as "light" | "dark" | undefined;
    if (t === "light" || t === "dark") setPluginTheme(t);
  };
  window.addEventListener("shell:theme-changed", themeHandler);

  const root = ReactDOM.createRoot(wrapper);
  root.render(<PluginApp ctx={ctx} initialSlug={ctx.sidebar?.slug ?? "programs"} />);

  return { root, wrapper, themeHandler, portalObserver };
}

/**
 * Called by the shell when the user navigates away. Accepts either the resolved
 * MountReturn or a Promise of it (some hosts capture mount()'s return without
 * awaiting).
 */
export async function unmount(state: MountReturn | Promise<MountReturn>): Promise<void> {
  const { root, wrapper, themeHandler, portalObserver } = await state;
  window.removeEventListener("shell:theme-changed", themeHandler);
  portalObserver.disconnect();
  disposePluginTheme(wrapper);
  root.unmount();
  wrapper.remove();
}
