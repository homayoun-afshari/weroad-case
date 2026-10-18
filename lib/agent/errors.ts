import { APICallError, RetryError } from "ai";
import { TurnError } from "./turn";

export interface Failure {
  status: number;
  /** Written for the user. Empty when nobody is waiting for it (the user pressed stop). */
  message: string;
  /** Whether it is worth an error in the server log: a stop is not. */
  log: boolean;
}

const MESSAGES = {
  timeout: "The assistant took too long to answer. Please try again.",
  noAnswer: "The assistant couldn't finish its answer. Please try again.",
  busy: "The assistant is busy right now. Please try again in a moment.",
  unavailable: "The assistant isn't available right now. Please try again later.",
};

const named = (error: unknown, name: string) => error instanceof Error && error.name === name;

/** The status of the provider's error, looking through the SDK's retry wrapper. */
function providerStatus(error: unknown): number | undefined {
  const inner = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(inner) ? inner.statusCode : undefined;
}

/**
 * What a failed turn means for the user. Each failure gets a message that says what to do, and none
 * leaks a detail: the detail goes to the server log. The page is never involved: a failed turn
 * changes nothing on it.
 */
export function describeFailure(error: unknown, options: { aborted: boolean }): Failure {
  // The user pressed stop (the request was cancelled): nobody is waiting for an answer
  if (options.aborted || named(error, "AbortError")) return { status: 499, message: "", log: false };
  if (named(error, "TimeoutError")) return { status: 504, message: MESSAGES.timeout, log: true };
  if (error instanceof TurnError) return { status: 502, message: MESSAGES.noAnswer, log: true };

  const status = providerStatus(error);
  // Too many requests, overloaded, or the provider's own error: trying again soon can work
  if (status !== undefined && (status === 429 || status >= 500)) return { status: 503, message: MESSAGES.busy, log: true };
  // Anything else (a bad key, a missing setting, a bug): trying again won't help the user
  return { status: 500, message: MESSAGES.unavailable, log: true };
}
