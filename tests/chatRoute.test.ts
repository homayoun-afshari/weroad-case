import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { getModel } from "@/lib/agent/model";
import { addUserMessage } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import { pageStateFor } from "@/lib/page/view";
import { mockModel, textReply, toolCall } from "./mockModel";

vi.mock("@/lib/agent/model", () => ({ getModel: vi.fn() }));

const page = pageStateFor({ text: "northern lights" });
const entries: ChatEntry[] = addUserMessage([{ kind: "assistant", text: "Hi." }], "max 1,500", page);
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/chat", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/chat", () => {
  it("runs a turn and returns the new entries and the page", async () => {
    vi.mocked(getModel).mockReturnValue(
      mockModel(toolCall("search_trips", { text: "northern lights", maxPrice: 1500 }), textReply("One trip left.")),
    );
    const response = await post({ entries, onScreen: [9, 11, 41] });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries.map((e: ChatEntry) => e.kind)).toEqual(["tools", "assistant"]);
    expect(body.page.results.map((r: { tripId: number }) => r.tripId)).toEqual([9]);
  });

  it("rejects a body that is not JSON, or not a chat history", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ entries: [{ kind: "mystery" }], onScreen: [] })).status).toBe(400);
    expect((await post({ entries })).status).toBe(400); // no trips on screen given
  });

  it("rejects a history that doesn't end with a user message", async () => {
    for (const bad of [[], [...entries, { kind: "assistant", text: "Done." }], [...entries, { kind: "error", text: "x" }]]) {
      const response = await post({ entries: bad, onScreen: [9] });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "The chat must end with a user message." });
    }
    expect(getModel).not.toHaveBeenCalled();
  });

  it("answers a failed turn with a clear message and no internals", async () => {
    vi.mocked(getModel).mockImplementation(() => {
      throw new Error("ANTHROPIC_API_KEY is not set");
    });
    const response = await post({ entries, onScreen: [9, 11, 41] });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "The assistant couldn't answer. Please try again." });
  });

  it("answers a turn that ends without an answer in the same way", async () => {
    vi.mocked(getModel).mockReturnValue(mockModel(textReply("")));
    const response = await post({ entries, onScreen: [9, 11, 41] });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "The assistant couldn't answer. Please try again." });
  });
});
