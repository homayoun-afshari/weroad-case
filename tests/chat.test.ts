import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { describeEvent, describeRequest, pageBlocks, pageStateBlock } from "@/lib/chat/blocks";
import { searchEvent, undoEvent } from "@/lib/chat/events";
import { addUserMessage, recordEvent, toModelMessages, userEntry, withoutTrailingErrors } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import { pageStateFor } from "@/lib/page/view";

const northern = pageStateFor({ text: "northern lights", maxPrice: 2000 });

describe("describing a search request", () => {
  it("writes the text and every filter that is set", () => {
    expect(
      describeRequest({
        text: "japan",
        maxPrice: 2500,
        dates: { from: "2026-12-01", to: "2026-12-08" },
        days: { min: 3, max: 8 },
        ageBand: "25-35",
        physicalRating: "LOW",
        privateRoom: true,
      }),
    ).toBe(
      '"japan" · max price €2,500 · dates: 2026-12-01 to 2026-12-08 · 3 to 8 days · age band 25-35 · physical effort low · private room',
    );
  });

  it("writes a duration with one end", () => {
    expect(describeRequest({ text: "", days: { min: 1 } })).toBe("no search text · at least 1 day");
    expect(describeRequest({ text: "", days: { max: 3 } })).toBe("no search text · at most 3 days");
  });
});

describe("page events", () => {
  it("records a search with how many results came back", () => {
    expect(describeEvent(searchEvent(northern))).toBe('user searched "northern lights" · max price €2,000 (2 results)');
    expect(describeEvent(searchEvent(pageStateFor({ text: "iceland" })))).toContain("(1 result)");
    expect(describeEvent(searchEvent(pageStateFor({ text: "hiking in Argentina", maxPrice: 2000 })))).toContain("(0 results)");
  });

  it("records an undo with whose change it reversed, what was undone and where the page went back to", () => {
    const before = pageStateFor({ text: "northern lights" });
    expect(describeEvent(undoEvent(northern, before, "assistant"))).toBe(
      `user undid the assistant's change ("northern lights" · max price €2,000) and is back to "northern lights"`,
    );
    expect(describeEvent(undoEvent(northern, before, "user"))).toContain("their own change");
  });
});

describe("page state block", () => {
  it("lists the search and the trips on screen", () => {
    expect(pageStateBlock(northern)).toBe(
      [
        "<page_state>",
        'search: "northern lights" · max price €2,000 · dates: none',
        "results (2): #9 Iceland (8 days, from €1,219), #11 Sweden (7 days, from €1,759)",
        "</page_state>",
      ].join("\n"),
    );
  });

  it("says when there are no results, and when dates are set", () => {
    const empty = pageStateFor({ text: "hiking in Argentina", maxPrice: 2000, dates: { from: "2026-12-01", to: "2026-12-08" } });
    const block = pageStateBlock(empty);
    expect(block).toContain("results (0): none");
    expect(block).toContain("dates: 2026-12-01 to 2026-12-08");
    expect(block).not.toContain("dates: none");
  });

  it("lists only the first ten of a long list, and says so", () => {
    const block = pageStateBlock(pageStateFor({ text: "" }));
    expect(block).toContain("results (50, first 10 shown):");
    expect(block.match(/#\d+ /g)).toHaveLength(10);
  });
});

describe("page blocks", () => {
  it("put the events before the page state", () => {
    expect(pageBlocks([searchEvent(northern)], northern)).toBe(
      [
        "<page_events>",
        'user searched "northern lights" · max price €2,000 (2 results)',
        "</page_events>",
        pageStateBlock(northern),
      ].join("\n"),
    );
  });

  it("leave out the events block when nothing happened on the page", () => {
    expect(pageBlocks([], northern)).toBe(pageStateBlock(northern));
  });
});

describe("user entry", () => {
  it("keeps what the user wrote apart from the page context", () => {
    const entry = userEntry("I only have 1–8 December", [searchEvent(northern)], northern);
    expect(entry).toEqual({
      kind: "user",
      text: "I only have 1–8 December",
      blocks: pageBlocks([searchEvent(northern)], northern),
    });
  });
});

describe("model messages", () => {
  const toolCall: ModelMessage = {
    role: "assistant",
    content: [{ type: "tool-call", toolCallId: "t1", toolName: "get_departures", input: { trips: [9] } }],
  };
  const toolResult: ModelMessage = {
    role: "tool",
    content: [{ type: "tool-result", toolCallId: "t1", toolName: "get_departures", output: { type: "json", value: { ok: true } } }],
  };

  it("puts the page context before the user's words", () => {
    const entries: ChatEntry[] = [userEntry("max 1,500", [], northern)];
    expect(toModelMessages(entries)).toEqual([
      { role: "user", content: `${pageStateBlock(northern)}\nmax 1,500` },
    ]);
  });

  it("keeps the order of a conversation, with the tool calls and results of a turn", () => {
    const entries: ChatEntry[] = [
      userEntry("when does it leave?", [], northern),
      { kind: "tools", messages: [toolCall, toolResult] },
      { kind: "assistant", text: "In December." },
      userEntry("thanks", [], northern),
    ];
    expect(toModelMessages(entries).map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant", "user"]);
  });

  it("starts at the first user message, skipping the first assistant message written by code", () => {
    const entries: ChatEntry[] = [
      { kind: "assistant", text: "You're looking at 2 trips for northern lights." },
      userEntry("hello", [], northern),
    ];
    const messages = toModelMessages(entries);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });

  it("keeps errors out of what the model reads", () => {
    const entries: ChatEntry[] = [
      userEntry("hello", [], northern),
      { kind: "error", text: "The assistant couldn't answer." },
      userEntry("hello again", [], northern),
    ];
    expect(toModelMessages(entries).map((m) => m.role)).toEqual(["user", "user"]);
  });
});

describe("page change cards", () => {
  const search = searchEvent(northern);
  const undo = undoEvent(northern, pageStateFor({ text: "northern lights" }), "assistant");

  it("start a card for the first event after a message", () => {
    const entries = recordEvent([{ kind: "assistant", text: "Hi." }], search);
    expect(entries).toEqual([{ kind: "assistant", text: "Hi." }, { kind: "page", events: [search] }]);
  });

  it("collect a run of events in one card", () => {
    const entries = recordEvent(recordEvent([{ kind: "assistant", text: "Hi." }], search), undo);
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({ kind: "page", events: [search, undo] });
  });

  it("start a new card after the next message and its answer", () => {
    let entries: ChatEntry[] = recordEvent([{ kind: "assistant", text: "Hi." }], search);
    entries = addUserMessage(entries, "thanks", northern);
    entries = [...entries, { kind: "assistant", text: "You're welcome." }];
    entries = recordEvent(entries, undo);
    expect(entries.map((e) => e.kind)).toEqual(["assistant", "page", "user", "assistant", "page"]);
    expect(entries[1]).toEqual({ kind: "page", events: [search] });
  });

  it("put the events of the card before a message into that message's page context", () => {
    const entries = addUserMessage(recordEvent([{ kind: "assistant", text: "Hi." }], search), "thanks", northern);
    expect(entries.at(-1)).toEqual(userEntry("thanks", [search], northern));
  });

  it("add no page events to a message that has no card before it", () => {
    const entries = addUserMessage([{ kind: "assistant", text: "Hi." }], "thanks", northern);
    expect(entries.at(-1)).toEqual(userEntry("thanks", [], northern));
  });

  it("are not sent to the model", () => {
    const entries = addUserMessage(recordEvent([{ kind: "assistant", text: "Hi." }], search), "thanks", northern);
    const messages = toModelMessages(entries);
    expect(messages).toHaveLength(1);
    expect(JSON.stringify(messages)).toContain("<page_events>");
  });
});

describe("history sent for a turn", () => {
  it("leaves out the errors after the user's message, so a retry can send it again", () => {
    const entries: ChatEntry[] = [
      { kind: "assistant", text: "Hi." },
      userEntry("hello", [], northern),
      { kind: "error", text: "failed" },
      { kind: "error", text: "failed again" },
    ];
    expect(withoutTrailingErrors(entries)).toEqual(entries.slice(0, 2));
  });

  it("keeps errors that have a message after them", () => {
    const entries: ChatEntry[] = [userEntry("a", [], northern), { kind: "error", text: "failed" }, userEntry("b", [], northern)];
    expect(withoutTrailingErrors(entries)).toEqual(entries);
  });

  it("handles an empty history", () => {
    expect(withoutTrailingErrors([])).toEqual([]);
  });
});
