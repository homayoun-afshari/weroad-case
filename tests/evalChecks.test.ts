import { describe, expect, it } from "vitest";
import { amountsIn, datesIn, groundingSources, numbersIn, promisesHandOver, staleTripsNamed, ungroundedFacts } from "@/evals/checks";
import { checkFaqAnswer, FAQ_CASES, type FaqCase } from "@/evals/faqCases";
import { pageStateBlock } from "@/lib/chat/blocks";
import { addUserMessage } from "@/lib/chat/history";
import type { ChatEntry, TurnResponse } from "@/lib/chat/types";
import { pageStateFor } from "@/lib/page/view";
import { getDepartures } from "@/lib/search/departures";

const first: ChatEntry = { kind: "assistant", text: "You're looking at 3 trips." };
const northern = pageStateFor({ text: "northern lights" });

/** A turn as the route answers it: a tool call and its result, then the assistant's message. */
function turn(output: unknown, text: string, page: TurnResponse["page"] = null): TurnResponse {
  return {
    page,
    entries: [
      { kind: "tools", messages: [
        { role: "assistant", content: [{ type: "tool-call", toolCallId: "c1", toolName: "t", input: {} }] },
        { role: "tool", content: [{ type: "tool-result", toolCallId: "c1", toolName: "t", output: { type: "text", value: typeof output === "string" ? output : JSON.stringify(output) } }] },
      ] },
      { kind: "assistant", text },
    ],
  };
}

describe("reading prices and dates out of a text", () => {
  it("finds prices as the assistant writes them", () => {
    expect(amountsIn("from €1,219, or €2539, or € 4,169; max 1.500 euros; 800 EUR")).toEqual([1219, 2539, 4169, 1500, 800]);
    expect(amountsIn("8 days, 2 seats left, 36 days")).toEqual([]);
  });

  it("finds the numbers of a source, in text and in JSON", () => {
    expect([...numbersIn('from €1,759 · "priceEur":1599,"seatsLeft":2')].sort((a, b) => a - b)).toEqual([2, 1599, 1759]);
  });

  it("finds days in ISO form, as ranges and as single days, in either order", () => {
    expect([...datesIn("on 2026-10-19")]).toEqual(["10-19"]);
    expect([...datesIn("19–24 October")].sort()).toEqual(["10-19", "10-24"]);
    expect([...datesIn("20-27 October")].sort()).toEqual(["10-20", "10-27"]);
    expect([...datesIn("1 to 8 December 2026")].sort()).toEqual(["12-01", "12-08"]);
    expect([...datesIn("31 October–6 November")].sort()).toEqual(["10-31", "11-06"]);
    expect([...datesIn("October 31st, Nov 6")].sort()).toEqual(["10-31", "11-06"]);
    expect([...datesIn("late September 2027, 5 days, 13 seats")]).toEqual([]);
    // the end of a year is not the start of a range (seen live: "25 December 2026 and 5 January 2027")
    expect([...datesIn("between 25 December 2026 and 5 January 2027")].sort()).toEqual(["01-05", "12-25"]);
    expect([...datesIn("26 Dec 2026 to 1 Jan 2027")].sort()).toEqual(["01-01", "12-26"]);
  });
});

describe("the strict check on prices and dates", () => {
  it("catches the live answer that named trips no longer on the page, with prices from an earlier turn", () => {
    const history = addUserMessage([first], "max 1,500 euros", northern);
    const page = pageStateFor({ text: "northern lights", maxPrice: 1500 });
    const answer =
      "I've capped the price at €1,500 for the northern lights search. One trip is left: the Iceland trip, 8 days from €1,219. Sweden (from €1,759) and Canada (from €2,539) are over the limit.";
    const found = ungroundedFacts(answer, groundingSources(history, turn(pageStateBlock(page), answer, page)));
    // €1,500 is the user's own number and €1,219 is on the page now; the other two came from the page before
    expect(found).toEqual({ prices: [1759, 2539], dates: [] });
  });

  it("passes the same answer without those prices", () => {
    const history = addUserMessage([first], "max 1,500 euros", northern);
    const page = pageStateFor({ text: "northern lights", maxPrice: 1500 });
    const answer = "I've capped the price at €1,500. One trip is left: Iceland, 8 days from €1,219. Sweden and Canada are over your limit.";
    expect(ungroundedFacts(answer, groundingSources(history, turn(pageStateBlock(page), answer, page)))).toEqual({ prices: [], dates: [] });
  });

  it("passes a departures answer whose prices and dates come from the tool", () => {
    const history = addUserMessage([first], "I only have 19-24 October", northern);
    const tool = getDepartures({ onScreen: [9, 11, 41], from: "2026-10-19", to: "2026-10-24" });
    const answer =
      "None fit. Iceland: 20–27 October, €1,599 (full price €1,869), 2 seats left. Sweden: 31 October–6 November, €2,109. Canada: 29 November–4 December, €2,579.";
    expect(ungroundedFacts(answer, groundingSources(history, turn(tool, answer)))).toEqual({ prices: [], dates: [] });
  });

  it("catches an invented price and an invented date in that answer", () => {
    const history = addUserMessage([first], "I only have 19-24 October", northern);
    const tool = getDepartures({ onScreen: [9, 11, 41], from: "2026-10-19", to: "2026-10-24" });
    const answer = "Iceland leaves 30 October for €1,399, and Sweden on 31 October for €2,109.";
    expect(ungroundedFacts(answer, groundingSources(history, turn(tool, answer)))).toEqual({ prices: [1399], dates: ["30 October"] });
  });

  it("allows what the user said, but not what the page showed before the turn", () => {
    const history = addUserMessage([first], "anything for 19-24 October under 800?", northern);
    const nothing = turn("nothing found", "");
    expect(ungroundedFacts("Your 19–24 October window and €800 limit match nothing.", groundingSources(history, nothing)).prices).toEqual([]);
    // the page state the user message carried is the page as it is when no search ran
    expect(ungroundedFacts("Sweden is from €1,759.", groundingSources(history, nothing)).prices).toEqual([]);
    const searched = turn("nothing found", "", pageStateFor({ text: "iceland" }));
    expect(ungroundedFacts("Sweden is from €1,759.", groundingSources(history, searched)).prices).toEqual([1759]);
  });

  it("counts a figure the assistant worked out as not stated, for a human to review", () => {
    const history = addUserMessage([first], "hiking in Argentina under 2000", northern);
    const page = pageStateFor({ text: "hiking in Argentina", maxPrice: 2000 });
    const answer = "Patagonia is €4,169, which is €2,169 over your €2,000 limit.";
    expect(ungroundedFacts(answer, groundingSources(history, turn(pageStateBlock(page), answer, page))).prices).toEqual([2169]);
  });

  it("finds nothing to check in an answer without prices or dates", () => {
    expect(ungroundedFacts("Sure, one moment.", [])).toEqual({ prices: [], dates: [] });
  });

  it("allows today's date, which the system prompt states", () => {
    const sources = groundingSources([first], turn("{}", "x"));
    expect(ungroundedFacts("Today, 16 October, it leaves soon.", sources).dates).toEqual([]);
  });
});

describe("the check for trips named after the search took them off the page", () => {
  const before = pageStateFor({ text: "northern lights" });
  const after = pageStateFor({ text: "cooking" });
  const gone = before.results.filter((r) => !after.results.some((a) => a.tripId === r.tripId)).map((r) => r.destination)[0];

  it("catches a destination that left the page", () => {
    expect(staleTripsNamed(`${gone} is also lovely.`, before, after, "cooking classes")).toEqual([gone]);
  });

  it("lets the answer name a trip the user named", () => {
    expect(staleTripsNamed(`${gone} is not shown now.`, before, after, `what about ${gone}?`)).toEqual([]);
  });

  it("finds nothing when no gone destination is named", () => {
    expect(staleTripsNamed("Here are the cooking trips.", before, after, "cooking")).toEqual([]);
  });
});

describe("the check for a promise of a human agent", () => {
  it("catches the sentences seen live that promise the connection", () => {
    for (const answer of [
      "I'll connect you with a human agent.",
      "I can connect you with a human agent for that. Let me do that now.",
      "I'll connect you with a human agent now.",
      "I'll pass you to a human agent.",
      "I'm connecting you with a person.",
    ]) {
      expect(promisesHandOver(answer)).toBe(true);
    }
  });

  it("lets the sentences that only offer one through", () => {
    for (const answer of [
      "I can't find visa information in WeRoad's help-center articles, so I can't answer that here.",
      "I can offer to connect you with a human agent who can help.",
      "I'll offer you a human agent who may be able to help.",
      "I can connect you with a human agent for this.",
      "I can't connect you to a person from this page myself, so I'll offer you a human agent now.",
    ]) {
      expect(promisesHandOver(answer)).toBe(false);
    }
  });
});

describe("help-center answers: what they say and must not", () => {
  const byId = (id: string) => FAQ_CASES.find((c) => c.id === id) as FaqCase;

  it("accepts the grounded answers seen live", () => {
    const grounded: [string, string][] = [
      ["visa", "I can't find visa information in WeRoad's help-center articles, so I can't answer that here."],
      ["plugs-iceland", "I don't have information about plugs in Iceland. The help-center article I can access for Iceland covers the weather only, so I can't answer that from our materials."],
      ["currency-sweden", "I don't have a currency article for Sweden in our help center, so I can't tell you what currency it uses."],
      ["unconfirmed-deposit", "If it's your first booking on an unconfirmed departure, you can book without paying anything: you leave your credit card details as a guarantee, a €/£/$0 deposit."],
      ["weather-iceland", "Iceland's weather depends on where you are: South Iceland has mild winters, and June to August is the mildest time, with the midnight sun."],
      ["cancel", "Yes, you can cancel on your own from MyWeRoad, in the trip management section."],
    ];
    for (const [id, answer] of grounded) expect(checkFaqAnswer(byId(id), answer), id).toEqual([]);
  });

  it("catches the breaches seen live", () => {
    const visa = "I can't find visa information in WeRoad's help center, so I can't answer. Visa rules also depend on your passport, so the official government website for each country is the best place to check.";
    expect(checkFaqAnswer(byId("visa"), visa)).toHaveLength(1);

    const sweden = "I don't have a currency article for Sweden, so I can't tell you what currency it uses. Your Sweden trip's Travel Group Leader can help with practical questions like this before you travel.";
    expect(checkFaqAnswer(byId("currency-sweden"), sweden)).toHaveLength(1);

    const guarantee = "If a departure is still \"Open to book\" and it's your first unconfirmed booking, you don't have to pay anything upfront. You only leave a credit card, PayPal, or Revolut as a guarantee, and the deposit is €/£/$0.";
    expect(checkFaqAnswer(byId("unconfirmed-deposit"), guarantee)).toHaveLength(1);
  });

  it("catches an answer that makes up what the article doesn't say, and one that doesn't admit it", () => {
    expect(checkFaqAnswer(byId("plugs-iceland"), "Iceland uses Type C and F plugs at 230V.")).toHaveLength(3);
    expect(checkFaqAnswer(byId("visa"), "Citizens of most countries can enter visa-free for 90 days.")).toEqual([`missing: ${byId("visa").mustSay[0]}`]);
  });

  it("has a case for every breach seen live, and each question is one a user asks", () => {
    expect(FAQ_CASES.map((c) => c.id)).toEqual(["visa", "plugs-iceland", "currency-sweden", "unconfirmed-deposit", "weather-iceland", "cancel"]);
    expect(FAQ_CASES.every((c) => c.question.endsWith("?"))).toBe(true);
  });
});
