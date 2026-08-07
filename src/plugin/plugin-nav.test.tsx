import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ShellNavBridge } from "@/PluginApp";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname}</div>;
}

function setup(initialSlug: string, productSlug = "sales-incentive") {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <ShellNavBridge productSlug={productSlug} initialSlug={initialSlug} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("ShellNavBridge", () => {
  it("routes to the initial slug on mount", () => {
    setup("performance");
    expect(screen.getByTestId("path").textContent).toBe("/analytics/performance");
  });

  it("routes on shell:navigate for this product", () => {
    setup("programs");
    act(() => {
      window.dispatchEvent(
        new CustomEvent("shell:navigate", { detail: { productSlug: "sales-incentive", slug: "roi" } }),
      );
    });
    expect(screen.getByTestId("path").textContent).toBe("/analytics/roi");
  });

  it("ignores shell:navigate for a different product", () => {
    setup("programs");
    act(() => {
      window.dispatchEvent(
        new CustomEvent("shell:navigate", { detail: { productSlug: "sfa", slug: "roi" } }),
      );
    });
    expect(screen.getByTestId("path").textContent).toBe("/programs");
  });
});
