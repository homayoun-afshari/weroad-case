import { describe, expect, it } from "vitest";
import { formToRequest, requestToForm, type FormValues } from "@/lib/page/form";
import { formatPrice } from "@/lib/page/format";
import { searchRequestSchema } from "@/lib/search/schema";
import type { SearchRequest } from "@/lib/search/types";

const empty = requestToForm({ text: "" });

describe("search controls", () => {
  it("send only the text when no filter is set", () => {
    expect(formToRequest({ ...empty, text: "  northern lights " })).toEqual({ text: "northern lights" });
  });

  it("send every filter that is set", () => {
    const form: FormValues = {
      text: "japan",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-30",
      maxPrice: "2500",
      minDays: "5",
      maxDays: "9",
      ageBand: "25-35",
      physicalRating: "LOW",
      privateRoom: true,
    };
    expect(formToRequest(form)).toEqual({
      text: "japan",
      dates: { from: "2026-11-01", to: "2026-11-30" },
      maxPrice: 2500,
      days: { min: 5, max: 9 },
      ageBand: "25-35",
      physicalRating: "LOW",
      privateRoom: true,
    });
  });

  it("leave out a date window with only one end, and prices that are empty or not positive", () => {
    expect(formToRequest({ ...empty, dateFrom: "2026-11-01" })).toEqual({ text: "" });
    expect(formToRequest({ ...empty, maxPrice: "" })).toEqual({ text: "" });
    expect(formToRequest({ ...empty, maxPrice: "0" })).toEqual({ text: "" });
    expect(formToRequest({ ...empty, maxPrice: "abc" })).toEqual({ text: "" });
  });

  it("keep a duration with one end", () => {
    expect(formToRequest({ ...empty, maxDays: "3" }).days).toEqual({ min: undefined, max: 3 });
  });

  it("build requests the search route accepts", () => {
    const request = formToRequest({ ...empty, text: "x", dateFrom: "2026-11-01", dateTo: "2026-11-02", minDays: "2" });
    expect(searchRequestSchema.safeParse(JSON.parse(JSON.stringify(request))).success).toBe(true);
  });

  it("show a restored request exactly (the undo button)", () => {
    const requests: SearchRequest[] = [
      { text: "" },
      { text: "northern lights", maxPrice: 2000 },
      { text: "a", dates: { from: "2026-11-01", to: "2026-11-30" }, days: { min: 3 }, privateRoom: true },
      { text: "b", ageBand: "18-25", physicalRating: "HIGH", days: { max: 7 } },
    ];
    for (const request of requests) {
      expect(JSON.parse(JSON.stringify(formToRequest(requestToForm(request))))).toEqual(request);
    }
  });
});

describe("formatPrice", () => {
  it("writes euros with a thousands separator and no cents", () => {
    expect(formatPrice(1219)).toBe("€1,219");
    expect(formatPrice(239)).toBe("€239");
  });
});
