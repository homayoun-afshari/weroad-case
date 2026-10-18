import { describe, expect, it } from "vitest";
import { firstMessage } from "@/lib/chat/firstMessage";
import { pageStateFor } from "@/lib/page/view";

const OFFER = "I can change the search, check dates or answer questions.";

describe("first message", () => {
  it("says what the page shows, from the page state", () => {
    expect(firstMessage(pageStateFor({ text: "northern lights" }))).toBe(
      `You're looking at 3 trips for "northern lights". They start from €1,219. ${OFFER}`,
    );
  });

  it("includes the filters that are set", () => {
    expect(firstMessage(pageStateFor({ text: "northern lights", maxPrice: 2000 }))).toBe(
      `You're looking at 2 trips for "northern lights", max price €2,000. They start from €1,219. ${OFFER}`,
    );
  });

  it("uses the singular for one trip", () => {
    expect(firstMessage(pageStateFor({ text: "iceland" }))).toBe(
      `You're looking at 1 trip for "iceland". It starts from €1,219. ${OFFER}`,
    );
  });

  it("handles a search with no text and no filters", () => {
    expect(firstMessage(pageStateFor({ text: "" }))).toBe(
      `You're looking at 50 trips. They start from €239. ${OFFER}`,
    );
  });

  it("says so when no trip matches and the page shows the nearest options", () => {
    expect(firstMessage(pageStateFor({ text: "hiking in Argentina", maxPrice: 2000 }))).toBe(
      `No trip matches "hiking in Argentina", max price €2,000 exactly. The page shows the 6 closest options instead. They start from €289. ${OFFER}`,
    );
    expect(firstMessage(pageStateFor({ text: "hiking in Brazil or Argentina end of September" }))).toBe(
      `No trip matches "hiking in Brazil or Argentina end of September" exactly. The page shows the closest option instead. It starts from €4,169. ${OFFER}`,
    );
  });

  it("says so when the page shows no trips at all", () => {
    const none = { ...pageStateFor({ text: "iceland" }), results: [] };
    expect(firstMessage(none)).toBe(`The page shows no trips for "iceland". ${OFFER}`);
  });

  it("states the cheapest price among the results shown, not among all trips", () => {
    const page = pageStateFor({ text: "northern lights" });
    const cheapest = Math.min(...page.results.map((r) => r.fromPrice));
    expect(firstMessage(page)).toContain(`from €${cheapest.toLocaleString("en-US")}`);
  });
});
