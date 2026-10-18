import { afterEach, describe, expect, it, vi } from "vitest";
import { cardLine } from "@/lib/chat/cards";
import { searchEvent, undoEvent } from "@/lib/chat/events";
import { ChatError, isAbort, postTurn } from "@/lib/chat/client";
import type { ChatEntry } from "@/lib/chat/types";
import { pageStateFor } from "@/lib/page/view";

const entries: ChatEntry[] = [{ kind: "user", text: "hello", blocks: "<page_state>…</page_state>" }];
const onScreen = [9, 11, 41];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("card lines", () => {
  const northern = pageStateFor({ text: "northern lights", maxPrice: 2000 });

  it("tell the user what they searched and what came back", () => {
    expect(cardLine(searchEvent(northern))).toBe('You searched "northern lights" · max price €2,000 → 2 trips');
    expect(cardLine(searchEvent(pageStateFor({ text: "iceland" })))).toContain("→ 1 trip");
    expect(cardLine(searchEvent(pageStateFor({ text: "hiking in Argentina", maxPrice: 2000 })))).toContain("→ no trips");
  });

  it("tell the user what they undid", () => {
    const before = pageStateFor({ text: "northern lights" });
    expect(cardLine(undoEvent(northern, before, "assistant"))).toBe(
      `You undid the assistant's change ("northern lights" · max price €2,000), back to "northern lights"`,
    );
    expect(cardLine(undoEvent(northern, before, "user"))).toContain("your own change");
  });
});

describe("asking for a turn", () => {
  it("sends the history and returns the new entries and the page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ entries: [{ kind: "assistant", text: "Hi!" }], page: null }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await postTurn(entries, onScreen);
    expect(result).toEqual({ entries: [{ kind: "assistant", text: "Hi!" }], page: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(JSON.parse(init.body)).toEqual({ entries, onScreen });
  });

  it("gives the server's message when the turn fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "The assistant couldn't answer. Please try again." }, 500)));
    await expect(postTurn(entries, onScreen)).rejects.toThrow("The assistant couldn't answer. Please try again.");
  });

  it("gives a clear message when the answer is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 })));
    const error = await postTurn(entries, onScreen).catch((e) => e);
    expect(error).toBeInstanceOf(ChatError);
    expect(error.message).toBe("The assistant couldn't answer. Please try again.");
  });

  it("says so when the server can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(postTurn(entries, onScreen)).rejects.toThrow("Couldn't reach the server.");
  });

  it("lets a stop (an abort) through as an abort, not as a connection error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    const error = await postTurn(entries, onScreen).catch((e) => e);
    expect(isAbort(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ChatError);
  });

  it("passes the abort signal to the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ entries: [], page: null }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await postTurn(entries, onScreen, controller.signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
