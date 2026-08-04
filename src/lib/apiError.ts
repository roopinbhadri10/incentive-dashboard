/**
 * User-facing error text for API failures.
 *
 * Backend errors are useful to developers and meaningless (often alarming) to
 * users — a bare Spring 400 body, or a whole HTML 503 page from a gateway, is
 * not something to render in the UI. Throw `ApiError` from the API layer so the
 * status code survives, then call `friendlyMessage()` at the point of display.
 * The technical detail stays on `error.detail` for `console.error`.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Raw response body, for logs — never shown to users. */
  readonly detail: string;

  constructor(status: number, detail = "", label = "API") {
    super(`${label} responded ${status}${detail ? `: ${detail}` : ""}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Generic copy per status class. Deliberately free of backend wording. */
function messageForStatus(status: number, action: string): string {
  if (status === 0) return `Couldn't reach the server. Check your connection and try again.`;
  if (status === 400 || status === 422)
    return `Some details couldn't be accepted. Please review the programme and try again.`;
  if (status === 401) return `Your session has expired. Sign in again to continue.`;
  if (status === 403) return `You don't have permission to ${action}.`;
  if (status === 404) return `That record no longer exists. Refresh and try again.`;
  if (status === 409) return `Someone else changed this first. Refresh and try again.`;
  if (status === 429) return `Too many requests. Wait a moment and try again.`;
  if (status >= 500) return `The service is temporarily unavailable. Please try again shortly.`;
  return `Something went wrong. Please try again.`;
}

/**
 * A short, generic sentence safe to show a user.
 *
 * @param err    the caught value
 * @param action what the user was doing, e.g. "publish this programme"
 */
export function friendlyMessage(err: unknown, action = "complete that"): string {
  if (err instanceof ApiError) return messageForStatus(err.status, action);
  // A fetch that never got a response (offline, DNS, CORS) throws TypeError.
  if (err instanceof TypeError) return messageForStatus(0, action);
  return `Something went wrong. Please try again.`;
}
