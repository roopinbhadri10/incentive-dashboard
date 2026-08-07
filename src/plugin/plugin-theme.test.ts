import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  disposePluginTheme,
  getPluginTheme,
  initPluginTheme,
  reapplyPluginTheme,
  setPluginTheme,
  togglePluginTheme,
} from "@/plugin/plugin-theme";

function makeWrapper() {
  const el = document.createElement("div");
  el.className = "incentive-scope";
  document.body.appendChild(el);
  return el;
}

describe("plugin-theme", () => {
  let wrapper: HTMLElement;

  beforeEach(() => {
    wrapper = makeWrapper();
    initPluginTheme(wrapper, "light");
  });

  afterEach(() => {
    disposePluginTheme(wrapper);
    document.body.innerHTML = "";
  });

  it("applies the seeded theme to the wrapper", () => {
    expect(getPluginTheme()).toBe("light");
    expect(wrapper.classList.contains("dark")).toBe(false);

    initPluginTheme(wrapper, "dark");
    expect(wrapper.classList.contains("dark")).toBe(true);
  });

  it("setPluginTheme re-themes the wrapper without touching <html>", () => {
    setPluginTheme("dark");
    expect(wrapper.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("keeps body-level portals in sync", () => {
    const portal = document.createElement("div");
    portal.className = "incentive-scope";
    document.body.appendChild(portal);

    setPluginTheme("dark");
    expect(portal.classList.contains("dark")).toBe(true);

    setPluginTheme("light");
    expect(portal.classList.contains("dark")).toBe(false);
  });

  it("reapply picks up a portal that opened after the last change", () => {
    setPluginTheme("dark");
    const late = document.createElement("div");
    late.className = "incentive-scope";
    document.body.appendChild(late);
    expect(late.classList.contains("dark")).toBe(false);

    reapplyPluginTheme();
    expect(late.classList.contains("dark")).toBe(true);
  });

  it("toggle broadcasts shell:theme-changed so the shell re-themes its own chrome", () => {
    const onEvent = vi.fn();
    window.addEventListener("shell:theme-changed", onEvent);

    togglePluginTheme();

    expect(wrapper.classList.contains("dark")).toBe(true);
    expect(onEvent).toHaveBeenCalledTimes(1);
    const detail = (onEvent.mock.calls[0][0] as CustomEvent<{ theme: string }>).detail;
    expect(detail.theme).toBe("dark");

    window.removeEventListener("shell:theme-changed", onEvent);
  });

  it("the shell's echo of our own value does not re-broadcast", () => {
    togglePluginTheme(); // → dark, 1 broadcast

    const onEvent = vi.fn();
    window.addEventListener("shell:theme-changed", onEvent);
    setPluginTheme("dark"); // the echo: same value, already applied
    expect(onEvent).not.toHaveBeenCalled();
    expect(getPluginTheme()).toBe("dark");

    window.removeEventListener("shell:theme-changed", onEvent);
  });
});
