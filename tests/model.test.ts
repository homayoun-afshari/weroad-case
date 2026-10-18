import { afterEach, describe, expect, it, vi } from "vitest";
import { getModel } from "@/lib/agent/model";

afterEach(() => vi.unstubAllEnvs());

describe("model", () => {
  it("says what to do when the API key is missing", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => getModel()).toThrow(".env.local");
  });

  it("uses the model named in the environment, and the cheap one otherwise", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5-5");
    expect(getModel()).toMatchObject({ modelId: "claude-sonnet-5-5" });
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(getModel()).toMatchObject({ modelId: "claude-haiku-5-5" });
  });
});
