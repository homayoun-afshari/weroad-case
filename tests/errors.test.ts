import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { describeFailure } from "@/lib/agent/errors";
import { TurnError } from "@/lib/agent/turn";

const provider = (statusCode: number, retryable = false) =>
  new APICallError({ message: `secret provider detail ${statusCode}`, url: "https://api.example", requestBodyValues: {}, statusCode, isRetryable: retryable });
const describe_ = (error: unknown, aborted = false) => describeFailure(error, { aborted });

describe("what a failed turn means for the user", () => {
  it("is nothing to answer or log when the user pressed stop", () => {
    expect(describe_(new Error("anything"), true)).toEqual({ status: 499, message: "", log: false });
    expect(describe_(new DOMException("aborted", "AbortError"))).toEqual({ status: 499, message: "", log: false });
  });

  it("says the assistant took too long when the turn timed out", () => {
    const failure = describe_(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    expect(failure).toEqual({ status: 504, message: "The assistant took too long to answer. Please try again.", log: true });
  });

  it("says the assistant couldn't finish when the turn ended without an answer", () => {
    expect(describe_(new TurnError("ended"))).toEqual({
      status: 502,
      message: "The assistant couldn't finish its answer. Please try again.",
      log: true,
    });
  });

  it("says the assistant is busy for a rate limit, an overload or a provider error", () => {
    for (const status of [429, 500, 502, 503, 529]) {
      expect(describe_(provider(status))).toEqual({
        status: 503,
        message: "The assistant is busy right now. Please try again in a moment.",
        log: true,
      });
    }
  });

  it("looks through the SDK's retry wrapper to the provider's status", () => {
    const retried = new RetryError({ message: "Failed after 2 attempts", reason: "maxRetriesExceeded", errors: [provider(529, true), provider(529, true)] });
    expect(describe_(retried).status).toBe(503);
    const wrappedAuth = new RetryError({ message: "x", reason: "errorNotRetryable", errors: [provider(401)] });
    expect(describe_(wrappedAuth).status).toBe(500);
  });

  it("says the assistant isn't available for anything that retrying won't fix: a bad key, a bug", () => {
    for (const error of [provider(401), provider(403), provider(400), new Error("ANTHROPIC_API_KEY is not set"), "a string", undefined]) {
      expect(describe_(error)).toEqual({
        status: 500,
        message: "The assistant isn't available right now. Please try again later.",
        log: true,
      });
    }
  });

  it("never puts a detail of the error in the message", () => {
    const errors = [provider(401), provider(529), new Error("secret"), new TurnError("secret"), new DOMException("secret", "TimeoutError")];
    for (const error of errors) expect(describe_(error).message).not.toMatch(/secret|api\.example|ANTHROPIC/);
  });
});
