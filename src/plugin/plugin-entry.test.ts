import { describe, it, expect } from "vitest";
import { manifest, mount, unmount } from "@/plugin-entry";
import type { ShellContext } from "@/plugin/shell-types";

function fakeCtx(overrides: Partial<ShellContext> = {}): ShellContext {
  return {
    user: null,
    theme: "light",
    sidebar: { slug: "programs" },
    product: { slug: "sales-incentive", id: "plugin-incentive" },
    updateSidebar: () => {},
    ...overrides,
  };
}

describe("plugin-entry", () => {
  it("re-exports the manifest with the expected id", () => {
    expect(manifest.id).toBe("plugin-incentive");
  });

  it("mount creates a .incentive-scope wrapper and unmount removes it", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const state = mount(container, fakeCtx());
    const wrapper = container.querySelector(".incentive-scope");
    expect(wrapper).not.toBeNull();

    await unmount(state);
    expect(container.querySelector(".incentive-scope")).toBeNull();

    container.remove();
  });

  it("mount applies the dark class when ctx.theme is dark", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const state = mount(container, fakeCtx({ theme: "dark" }));
    const wrapper = container.querySelector(".incentive-scope") as HTMLElement;
    expect(wrapper.classList.contains("dark")).toBe(true);

    return unmount(state).then(() => container.remove());
  });
});
