import "@testing-library/jest-dom";
import { installFixtureKpiCatalog } from "./kpiCatalogFixture";

// KPIs are API-only, so the module-level catalog is empty until config loads. Every
// test runs against an installed catalogue, mirroring the app after shell mount.
installFixtureKpiCatalog();

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
