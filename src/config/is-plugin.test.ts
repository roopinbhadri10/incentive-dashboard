import { describe, it, expect } from "vitest";
import { isPlugin } from "@/config/is-plugin";

describe("isPlugin", () => {
  it("is false when __IS_PLUGIN__ is not defined (test/standalone env)", () => {
    expect(isPlugin).toBe(false);
  });
});
