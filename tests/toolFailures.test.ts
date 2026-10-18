import { beforeEach, describe, expect, it, vi } from "vitest";
import { runTurn } from "@/lib/agent/turn";
import { addUserMessage } from "@/lib/chat/history";
import { pageStateFor } from "@/lib/page/view";
import { mockModel, textReply, toolCall } from "./mockModel";

// The tools' data functions fail; everything else is real
vi.mock("@/lib/search/departures", async (original) => ({
  ...(await original<typeof import("@/lib/search/departures")>()),
  getDepartures: vi.fn(() => {
    throw new Error("secret internal detail: the data file is corrupt");
  }),
}));
vi.mock("@/lib/page/view", async (original) => {
  const actual = await original<typeof import("@/lib/page/view")>();
  return { ...actual, pageStateFor: vi.fn(actual.pageStateFor) };
});

const northern = pageStateFor({ text: "northern lights" });
const onScreen = northern.results.map((r) => r.tripId);
const asked = (text: string) => addUserMessage([{ kind: "assistant", text: "Hi." }], text, northern);

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a tool that fails", () => {
  it("doesn't take the turn down: the agent is told and answers", async () => {
    const model = mockModel(toolCall("get_departures", {}), textReply("I couldn't get the departures right now. Please try again."));
    const result = await runTurn({ model, onScreen, entries: asked("when does it leave?") });
    expect(result.entries.map((e) => e.kind)).toEqual(["tools", "assistant"]);
    expect(result.entries[1]).toEqual({ kind: "assistant", text: "I couldn't get the departures right now. Please try again." });
  });

  it("gives the agent a plain message, never the detail", async () => {
    const model = mockModel(toolCall("get_departures", {}), textReply("Sorry."));
    await runTurn({ model, onScreen, entries: asked("when does it leave?") });
    const second = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(second).toContain('"type":"error-text"');
    expect(second).toContain("get_departures failed: its result is not available right now.");
    expect(second).not.toContain("secret internal detail");
    expect(second).not.toContain("corrupt");
  });

  it("logs the detail on the server", async () => {
    const model = mockModel(toolCall("get_departures", {}), textReply("Sorry."));
    await runTurn({ model, onScreen, entries: asked("when does it leave?") });
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][0]).toBe("tool get_departures failed");
    expect(String(logged.mock.calls[0][1])).toContain("secret internal detail");
  });

  it("leaves the page as it was when search_trips fails", async () => {
    const { pageStateFor: search } = await import("@/lib/page/view");
    vi.mocked(search).mockImplementationOnce(() => {
      throw new Error("boom in the search");
    });
    const model = mockModel(toolCall("search_trips", { text: "iceland" }), textReply("I couldn't run that search right now."));
    const result = await runTurn({ model, onScreen, entries: asked("just iceland") });
    expect(result.page).toBeNull();
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("search_trips failed: its result is not available right now.");
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).not.toContain("boom in the search");
  });

  it("keeps working for the next call: one failure doesn't break the tool", async () => {
    const { pageStateFor: search } = await import("@/lib/page/view");
    vi.mocked(search).mockImplementationOnce(() => {
      throw new Error("once");
    });
    const first = mockModel(toolCall("search_trips", { text: "iceland" }), textReply("Sorry."));
    await runTurn({ model: first, onScreen, entries: asked("just iceland") });
    const second = mockModel(toolCall("search_trips", { text: "iceland" }), textReply("One trip."));
    const result = await runTurn({ model: second, onScreen, entries: asked("just iceland") });
    expect(result.page?.results.map((r) => r.tripId)).toEqual([9]);
  });

  it("tells the agent, in the prompt, to say so plainly and not guess", async () => {
    const model = mockModel(textReply("Hello."));
    await runTurn({ model, onScreen, entries: asked("hello") });
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("When a tool returns an error, tell the user plainly");
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("never guess what the tool would have said");
  });
});
