import { describe, expect, it } from "vitest";
import { pageStateFor, toView } from "@/lib/page/view";
import { search } from "@/lib/search/search";

describe("result view", () => {
  it("keeps what the list shows and drops the long texts", () => {
    const [result] = search({ text: "iceland" }).results;
    const view = toView(result);
    expect(view).toEqual({
      tripId: result.trip.id,
      title: result.trip.title,
      destination: "Iceland",
      days: result.trip.numberOfDays,
      url: result.trip.url,
      fromPrice: result.fromPrice,
      state: result.state,
    });
    expect(JSON.stringify(view)).not.toContain(result.trip.description.slice(0, 40));
  });

  it("links to the trip page on weroad.com", () => {
    const { results } = pageStateFor({ text: "" });
    expect(results.every((r) => r.url.startsWith("https://www.weroad.com/"))).toBe(true);
  });
});

describe("page state for a search request", () => {
  it("echoes the request and carries the original state and the results", () => {
    const request = { text: "northern lights" };
    const page = pageStateFor(request);
    expect(page.request).toEqual(request);
    expect(page.originalState.tripTypes).toEqual(["Northern Lights"]);
    expect(page.results.map((r) => r.tripId)).toEqual([9, 11, 41]);
  });

  it("is small enough to send for the biggest search", () => {
    const size = JSON.stringify(pageStateFor({ text: "" })).length;
    expect(size).toBeLessThan(40_000);
  });
});
