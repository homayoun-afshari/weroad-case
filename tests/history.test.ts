import { describe, expect, it } from "vitest";
import { canUndo, createHistory, current, push, sameRequest, undo } from "@/lib/page/history";
import type { PageState } from "@/lib/page/types";

function page(text: string): PageState {
  const state = { text, destinations: [], tripTypes: [] };
  return { request: { text }, originalState: state, results: [] };
}

describe("page history", () => {
  it("starts with the page that opened, and cannot go back from it", () => {
    const history = createHistory(page("northern lights"));
    expect(current(history).request.text).toBe("northern lights");
    expect(canUndo(history)).toBe(false);
    expect(undo(history)).toBeNull();
  });

  it("makes the latest push the current page state", () => {
    const history = push(createHistory(page("a")), page("b"), "user");
    expect(current(history).request.text).toBe("b");
    expect(canUndo(history)).toBe(true);
  });

  it("goes back one state at a time", () => {
    let history = createHistory(page("a"));
    history = push(history, page("b"), "user");
    history = push(history, page("c"), "assistant");

    const first = undo(history)!;
    expect(current(first.history).request.text).toBe("b");
    const second = undo(first.history)!;
    expect(current(second.history).request.text).toBe("a");
    expect(undo(second.history)).toBeNull();
  });

  it("says whose change it reversed", () => {
    let history = createHistory(page("a"));
    history = push(history, page("b"), "user");
    history = push(history, page("c"), "assistant");

    const first = undo(history)!;
    expect(first.reversed).toBe("assistant");
    expect(undo(first.history)!.reversed).toBe("user");
  });

  it("builds on the restored state after an undo, with no redo", () => {
    let history = push(createHistory(page("a")), page("b"), "assistant");
    history = undo(history)!.history;
    history = push(history, page("c"), "user");
    expect(history.entries.map((e) => e.state.request.text)).toEqual(["a", "c"]);
  });

  it("never changes the history it was given", () => {
    const history = push(createHistory(page("a")), page("b"), "user");
    const before = JSON.stringify(history);
    push(history, page("c"), "assistant");
    undo(history);
    expect(JSON.stringify(history)).toBe(before);
  });
});

describe("the same search again", () => {
  it("is the same request whatever the order of its fields or its undefined ones", () => {
    expect(sameRequest({ text: "a", maxPrice: 2000, dates: { from: "2026-10-19", to: "2026-10-24" } }, { dates: { to: "2026-10-24", from: "2026-10-19" }, maxPrice: 2000, text: "a" })).toBe(true);
    expect(sameRequest({ text: "a", maxPrice: undefined }, { text: "a" })).toBe(true);
    expect(sameRequest({ text: "a", maxPrice: 2000 }, { text: "a", maxPrice: 1500 })).toBe(false);
    expect(sameRequest({ text: "a" }, { text: "b" })).toBe(false);
  });

  it("adds no step to the history: Undo would go back to the same page", () => {
    const history = push(createHistory(page("a")), page("b"), "assistant");
    expect(push(history, page("b"), "user")).toBe(history);
    expect(history.entries).toHaveLength(2);
    expect(undo(push(history, page("b"), "user"))!.reversed).toBe("assistant");
  });
});
