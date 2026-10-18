import { describe, expect, it } from "vitest";
import { MAX_STEPS, runTurn, TurnError } from "@/lib/agent/turn";
import { addUserMessage } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import { pageStateFor } from "@/lib/page/view";
import { mockModel, textReply, toolCall } from "./mockModel";

const northern = pageStateFor({ text: "northern lights" });
const onScreen = northern.results.map((r) => r.tripId);
const opening: ChatEntry[] = [{ kind: "assistant", text: "You're looking at 3 trips." }];
const asked = (text: string, entries = opening) => addUserMessage(entries, text, northern);

describe("a turn", () => {
  it("searches with the tool, applies the new page state and answers", async () => {
    const model = mockModel(
      toolCall("search_trips", { text: "northern lights", maxPrice: 1500 }),
      textReply("Showing 1 trip under €1,500."),
    );
    const result = await runTurn({ model, onScreen, entries: asked("max 1,500") });

    expect(result.entries.map((e) => e.kind)).toEqual(["tools", "assistant"]);
    expect(result.entries[1]).toEqual({ kind: "assistant", text: "Showing 1 trip under €1,500." });
    expect(result.page).toEqual(pageStateFor({ text: "northern lights", maxPrice: 1500 }));
    expect(result.page?.results.map((r) => r.tripId)).toEqual([9]);
    const tools = result.entries[0];
    expect(tools.kind === "tools" && tools.messages.map((m) => m.role)).toEqual(["assistant", "tool"]);
  });

  it("gives the model the instructions, the page context and the user's words", async () => {
    const model = mockModel(textReply("Hello."));
    await runTurn({ model, onScreen, entries: asked("hello") });

    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain("Today is 2026-10-16");
    expect(prompt).toContain("<page_state>");
    expect(prompt).toContain("results (3): #9 Iceland");
    expect(prompt).toContain("hello");
    expect(JSON.stringify(model.doGenerateCalls[0].tools)).toContain("search_trips");
  });

  it("shows the model the search results the tool found", async () => {
    const model = mockModel(toolCall("search_trips", { text: "iceland" }), textReply("One trip."));
    await runTurn({ model, onScreen, entries: asked("just iceland") });
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("results (1): #9 Iceland");
  });

  it("leaves the page alone when the agent doesn't search", async () => {
    const model = mockModel(textReply("Happy to help."));
    const result = await runTurn({ model, onScreen, entries: asked("hello") });
    expect(result.entries).toEqual([{ kind: "assistant", text: "Happy to help." }]);
    expect(result.page).toBeNull();
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("applies the last search when the agent searches twice", async () => {
    const model = mockModel(
      toolCall("search_trips", { text: "sweden" }, "call-1"),
      toolCall("search_trips", { text: "iceland" }, "call-2"),
      textReply("Iceland it is."),
    );
    const result = await runTurn({ model, onScreen, entries: asked("sweden, no wait, iceland") });
    expect(result.page?.request.text).toBe("iceland");
    expect(result.entries[0].kind === "tools" && result.entries[0].messages).toHaveLength(4);
  });

  it("sends the tool calls and results of earlier turns again", async () => {
    const earlier: ChatEntry[] = [
      ...opening,
      ...asked("max 1,500").slice(1),
      {
        kind: "tools",
        messages: [
          { role: "assistant", content: [{ type: "tool-call", toolCallId: "old", toolName: "search_trips", input: { text: "x" } }] },
          { role: "tool", content: [{ type: "tool-result", toolCallId: "old", toolName: "search_trips", output: { type: "text", value: "ok" } }] },
        ],
      },
      { kind: "assistant", text: "Done." },
    ];
    const model = mockModel(textReply("Sure."));
    await runTurn({ model, onScreen, entries: addUserMessage(earlier, "thanks", northern) });
    expect(model.doGenerateCalls[0].prompt.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool", "assistant", "user"]);
  });

  it("tells the agent about a search the tool can't make, and carries on", async () => {
    const model = mockModel(toolCall("search_trips", { text: "x", maxPrice: -5 }), textReply("Sorry, let me try again."));
    const result = await runTurn({ model, onScreen, entries: asked("negative price") });
    expect(result.page).toBeNull();
    expect(result.entries.at(-1)).toEqual({ kind: "assistant", text: "Sorry, let me try again." });
    const second = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(second).toContain('"type":"error-text"');
    expect(second).toContain("maxPrice");
  });

  it("stops at the step limit and says the turn has no answer", async () => {
    const looping = Array.from({ length: MAX_STEPS }, (_, i) => toolCall("search_trips", { text: "x" }, `call-${i}`));
    const model = mockModel(...looping);
    await expect(runTurn({ model, onScreen, entries: asked("loop") })).rejects.toBeInstanceOf(TurnError);
    expect(model.doGenerateCalls).toHaveLength(MAX_STEPS);
  });

  it("passes a model failure on", async () => {
    const { MockLanguageModelV4 } = await import("ai/test");
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("model is down");
      },
    });
    await expect(runTurn({ model, onScreen, entries: asked("hello") })).rejects.toThrow("model is down");
  });
});

describe("a turn that asks for departures", () => {
  it("reads the departures of the trips on screen and leaves the page alone", async () => {
    const model = mockModel(
      toolCall("get_departures", { from: "2026-10-19", to: "2026-10-24" }),
      textReply("None of these fit; the nearest is Iceland."),
    );
    const result = await runTurn({ model, onScreen, entries: asked("I only have 19-24 October") });

    expect(result.page).toBeNull();
    expect(result.entries.map((e) => e.kind)).toEqual(["tools", "assistant"]);
    const second = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(second).toContain("tool-result");
    expect(second).toContain("noTripFitsWindow");
    expect(second).toContain("nearestAfter");
    // the trips asked about are the ones on screen: Iceland, Sweden, Canada
    for (const id of onScreen) expect(second).toContain(`"tripId":${id}`);
  });

  it("offers the tool next to search_trips", async () => {
    const model = mockModel(textReply("Hello."));
    await runTurn({ model, onScreen, entries: asked("hello") });
    const tools = JSON.stringify(model.doGenerateCalls[0].tools);
    expect(tools).toContain("get_departures");
    expect(tools).toContain("search_trips");
  });

  it("tells the agent about a trip that is not on screen", async () => {
    const model = mockModel(toolCall("get_departures", { tripIds: [9, 3] }), textReply("Morocco isn't on the page."));
    await runTurn({ model, onScreen, entries: asked("and Morocco?") });
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("notOnScreen");
  });

  it("answers half a window with an error the agent can fix", async () => {
    const model = mockModel(toolCall("get_departures", { from: "2026-10-19" }), textReply("Which end date?"));
    const result = await runTurn({ model, onScreen, entries: asked("from 19 October") });
    expect(result.page).toBeNull();
    const second = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(second).toContain('"type":"error-text"');
    expect(second).toContain("Send both from and to");
  });
});
