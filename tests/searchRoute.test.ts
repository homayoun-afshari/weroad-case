import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/search/route";
import * as view from "@/lib/page/view";
import type { PageState } from "@/lib/page/types";

vi.mock("@/lib/page/view", async (original) => {
  const actual = await original<typeof import("@/lib/page/view")>();
  return { ...actual, pageStateFor: vi.fn(actual.pageStateFor) };
});

const post = (body: string) =>
  POST(new Request("http://localhost/api/search", { method: "POST", body }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/search", () => {
  it("returns the page state for a valid search request", async () => {
    const response = await post(JSON.stringify({ text: "northern lights", maxPrice: 2000 }));
    expect(response.status).toBe(200);
    const page = (await response.json()) as PageState;
    expect(page.request).toEqual({ text: "northern lights", maxPrice: 2000 });
    expect(page.results.length).toBeGreaterThan(0);
    expect(page.results.every((r) => r.fromPrice <= 2000)).toBe(true);
  });

  it("answers a search with no exact match with the nearest options, not an empty list or an error", async () => {
    const response = await post(JSON.stringify({ text: "hiking in Argentina under 2000" }));
    expect(response.status).toBe(200);
    const page = (await response.json()) as PageState;
    expect(page.results[0].tripId).toBe(23);
    expect(page.results[0].state.maxPrice).toBeUndefined();
    expect(page.originalState.maxPrice).toBe(2000);
  });

  it("rejects a body that is not JSON, with a message for the user", async () => {
    const response = await post("not json");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The search request wasn't valid JSON." });
  });

  it("rejects an invalid search request and says which part", async () => {
    const response = await post(JSON.stringify({ text: "x", dates: { from: "2026-10-24", to: "2026-10-19" } }));
    expect(response.status).toBe(400);
    const { error } = (await response.json()) as { error: string };
    expect(error).toContain("dates");
    expect(error).toContain("start date");
  });

  it("rejects a missing text and a wrong filter value", async () => {
    expect((await post(JSON.stringify({}))).status).toBe(400);
    expect((await post(JSON.stringify({ text: "", ageBand: "40-50" }))).status).toBe(400);
    expect((await post(JSON.stringify({ text: "", maxPrice: -5 }))).status).toBe(400);
  });

  it("answers an unexpected failure with a clear message and no internals", async () => {
    vi.mocked(view.pageStateFor).mockImplementationOnce(() => {
      throw new Error("boom: secret detail");
    });
    const response = await post(JSON.stringify({ text: "japan" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "The search failed. Please try again." });
  });
});
