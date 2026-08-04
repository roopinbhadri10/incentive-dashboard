import { describe, it, expect } from "vitest";
import { ApiError, friendlyMessage } from "@/lib/apiError";

describe("ApiError", () => {
  it("keeps status and raw detail for logs, out of the user-facing message", () => {
    const raw = '{"timestamp":"2026-08-04T08:20:45.914+00:00","status":400,"error":"Bad Request","path":"/v1/rules"}';
    const err = new ApiError(400, raw, "Rule API");

    expect(err.status).toBe(400);
    expect(err.detail).toBe(raw);
    // The technical message is still available for console.error.
    expect(err.message).toContain("Rule API responded 400");

    // ...but nothing from the backend reaches the user.
    const shown = friendlyMessage(err, "publish this programme");
    expect(shown).not.toContain("400");
    expect(shown).not.toContain("Bad Request");
    expect(shown).not.toContain("/v1/rules");
    expect(shown).not.toContain("timestamp");
  });
});

describe("friendlyMessage", () => {
  it("maps each status class to generic copy", () => {
    expect(friendlyMessage(new ApiError(400))).toMatch(/couldn't be accepted/i);
    expect(friendlyMessage(new ApiError(422))).toMatch(/couldn't be accepted/i);
    expect(friendlyMessage(new ApiError(401))).toMatch(/session has expired/i);
    expect(friendlyMessage(new ApiError(403), "archive this programme")).toMatch(
      /don't have permission to archive this programme/i,
    );
    expect(friendlyMessage(new ApiError(404))).toMatch(/no longer exists/i);
    expect(friendlyMessage(new ApiError(409))).toMatch(/changed this first/i);
    expect(friendlyMessage(new ApiError(429))).toMatch(/too many requests/i);
    expect(friendlyMessage(new ApiError(503))).toMatch(/temporarily unavailable/i);
    expect(friendlyMessage(new ApiError(500))).toMatch(/temporarily unavailable/i);
  });

  it("treats a failed fetch (no response) as a connectivity problem", () => {
    expect(friendlyMessage(new TypeError("Failed to fetch"))).toMatch(/couldn't reach the server/i);
  });

  it("never leaks the message of an unknown thrown value", () => {
    expect(friendlyMessage(new Error("connect ECONNREFUSED 10.0.0.1:8080"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(friendlyMessage("raw string blow-up")).toBe("Something went wrong. Please try again.");
  });

  it("does not echo an HTML gateway error page", () => {
    const html = "<html><head><title>503 Service Temporarily Unavailable</title></head></html>";
    const shown = friendlyMessage(new ApiError(503, html), "load programmes");
    expect(shown).not.toContain("<html>");
    expect(shown).not.toContain("503");
  });
});
