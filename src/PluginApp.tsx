import { useCallback, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { TourProvider } from "@/components/tour/TourContext";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppRoutes } from "@/AppRoutes";
import { NavBarPortal } from "@/plugin/NavBarPortal";
import { slugToPath } from "@/plugin/slug-routes";
import type { ShellContext } from "@/plugin/shell-types";

const queryClient = new QueryClient();

interface PluginAppProps {
  ctx: ShellContext;
  initialSlug: string;
}

/**
 * Bridges shell navigation → the plugin's MemoryRouter. The shell sends the
 * active slug once at mount (initialSlug) and then dispatches a `shell:navigate`
 * window event for every later sidebar click — it keeps the bundle mounted and
 * does NOT remount on slug change (see SHELL PluginHost.tsx). We translate slug
 * → internal route and navigate.
 */
export function ShellNavBridge({
  productSlug,
  initialSlug,
}: {
  productSlug: string;
  initialSlug: string;
}) {
  const navigate = useNavigate();

  // Route to the initial slug once on mount.
  useEffect(() => {
    navigate(slugToPath(initialSlug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to subsequent shell navigations for this product.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { productSlug?: string; slug?: string }
        | undefined;
      if (!detail) return;
      if (detail.productSlug && detail.productSlug !== productSlug) return;
      navigate(slugToPath(detail.slug));
    };
    window.addEventListener("shell:navigate", handler as EventListener);
    return () => window.removeEventListener("shell:navigate", handler as EventListener);
  }, [navigate, productSlug]);

  return null;
}

/**
 * Owns the tour state for the plugin build. It has to sit ABOVE NavBarPortal:
 * the replay-tour button is portaled into the shell's NavBar, which is outside
 * AppLayout, so a provider inside the layout couldn't reach it. AppLayout skips
 * its own TourProvider under `isPlugin` for exactly this reason.
 *
 * Mounting the provider does NOT start the tour — its first-visit auto-start is
 * suppressed in plugin mode, so it only ever runs from the header button.
 */
function PluginTourHost({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const onNavigate = useCallback((path: string) => navigate(path), [navigate]);
  return <TourProvider onNavigate={onNavigate}>{children}</TourProvider>;
}

export default function PluginApp({ ctx, initialSlug }: PluginAppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MemoryRouter initialEntries={[slugToPath(initialSlug)]}>
          <ShellNavBridge productSlug={ctx.product.slug} initialSlug={initialSlug} />
          <PluginTourHost>
            <NavBarPortal ctx={ctx} />
            <AppRoutes />
          </PluginTourHost>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
