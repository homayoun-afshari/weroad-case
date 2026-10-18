import { describe, expect, it } from "vitest";
import { resultTags } from "@/lib/page/tags";
import { trips } from "@/lib/search/catalog";
import type { ResultView } from "@/lib/page/types";
import { pageStateFor } from "@/lib/page/view";
import { translate } from "@/lib/search/translator";
import type { SearchRequest, SearchState } from "@/lib/search/types";

const tagsOf = (request: SearchRequest) => {
  const page = pageStateFor(request);
  return page.results.map((r) => ({ id: r.tripId, tags: resultTags(page.originalState, r) }));
};

describe("the tags of a search result", () => {
  it("are none for a result found for the search itself", () => {
    expect(tagsOf({ text: "northern lights" }).every((r) => r.tags.length === 0)).toBe(true);
  });

  it("say how far over the price a result is: '€4,169 · above your €2,000'", () => {
    const [patagonia, ...rest] = tagsOf({ text: "hiking in Argentina under 2000" });
    expect(patagonia).toEqual({ id: 23, tags: ["€4,169 · above your €2,000"] });
    // the others are in other countries, and the tag says why they are there
    expect(rest.length).toBeGreaterThan(0);
    for (const r of rest) expect(r.tags).toEqual(["other destination (you asked for Argentina)"]);
  });

  it("say when no departure is inside the dates", () => {
    const results = tagsOf({ text: "", dates: { from: "2026-10-19", to: "2026-10-24" } });
    expect(results).toHaveLength(10);
    for (const r of results) expect(r.tags).toEqual(["no departure inside your dates"]);
  });

  it("say each value that was loosened, in the fixed order", () => {
    const [iceland] = tagsOf({ text: "iceland", dates: { from: "2026-10-19", to: "2026-10-24" }, maxPrice: 500 });
    expect(iceland.tags).toEqual(["no departure inside your dates", "€1,219 · above your €500"]);
  });

  it("say when the duration was loosened, with what was asked", () => {
    const [japan] = tagsOf({ text: "japan", days: { min: 100, max: 200 } });
    const days = trips.find((t) => t.id === 2)!.numberOfDays;
    expect(japan.tags).toEqual([`${days} days · outside your 100 to 200 days`]);
  });

  it("say which words and which trip type were not applied", () => {
    expect(tagsOf({ text: "northern lights in Brazil" })[0].tags).toEqual(['words not applied: "brazil"']);
    const types = tagsOf({ text: "northern lights", maxPrice: 1500, dates: { from: "2026-12-01", to: "2026-12-08" } });
    expect(types.find((r) => r.id === 5)?.tags).toEqual(["trip type not applied: Northern Lights"]);
  });

  it("say that an age band, a physical effort and a private room were not applied", () => {
    const original: SearchState = translate({ text: "japan", ageBand: "25-35", physicalRating: "LOW", privateRoom: true });
    const result: ResultView = {
      tripId: 2,
      title: "Japan",
      destination: "Japan",
      days: 13,
      url: "https://www.weroad.com/x",
      fromPrice: 2629,
      state: translate({ text: "japan" }),
    };
    expect(resultTags(original, result)).toEqual([
      "age band not applied (you asked 25-35)",
      "physical effort not applied (you asked low)",
      "private room not applied",
    ]);
  });
});
