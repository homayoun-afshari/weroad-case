"use client";

import { useEffect, useRef, useState } from "react";
import { ChatError, isAbort, postTurn } from "@/lib/chat/client";
import { searchEvent, undoEvent } from "@/lib/chat/events";
import { firstMessage } from "@/lib/chat/firstMessage";
import { addUserMessage, recordEvent, withoutTrailingErrors } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import { formToRequest, requestToForm, type FormValues } from "@/lib/page/form";
import { canUndo, createHistory, current, push, undo } from "@/lib/page/history";
import type { PageState } from "@/lib/page/types";
import { ChatPanel } from "./ChatPanel";
import { MESSAGE_BOX_MS, MessageBox, type Notice } from "./MessageBox";
import { ResultsList } from "./ResultsList";
import { SearchControls } from "./SearchControls";

/** The whole screen: the search controls, the results list, the chat and the message box. */
export function SearchApp({ initial }: { initial: PageState }) {
  const [history, setHistory] = useState(() => createHistory(initial));
  const [form, setForm] = useState(() => requestToForm(initial.request));
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [thinking, setThinking] = useState(false);
  const turn = useRef<AbortController | null>(null);

  const page = current(history);
  const chatStarted = entries.length > 0;

  // The message box closes by itself; a new message starts the timer again
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), MESSAGE_BOX_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  async function onSearch() {
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formToRequest(form)),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The search failed. Please try again.");
      const next = body as PageState;
      setHistory((h) => push(h, next, "user"));
      // The chat shows what the user did on the page, and the agent learns it with the next message
      if (chatStarted) setEntries((e) => recordEvent(e, searchEvent(next)));
    } catch (e) {
      const body =
        e instanceof TypeError
          ? "Couldn't reach the server. Check your connection and try again."
          : (e as Error).message;
      setNotice({ title: "Search failed", body });
    } finally {
      setPending(false);
    }
  }

  function onUndo() {
    const undone = undo(history);
    if (!undone) return;
    const restored = current(undone.history);
    setHistory(undone.history);
    setForm(requestToForm(restored.request));
    if (chatStarted) setEntries((e) => recordEvent(e, undoEvent(page, restored, undone.reversed)));
  }

  /** Starting the chat: the first message is written by code from the page as it is now. */
  function onStart() {
    setEntries([{ kind: "assistant", text: firstMessage(page) }]);
  }

  /** One turn: the agent answers, and if it searched, the page follows as the assistant's change. */
  async function runTurn(sent: ChatEntry[]) {
    const controller = new AbortController();
    turn.current = controller;
    setThinking(true);
    try {
      const result = await postTurn(withoutTrailingErrors(sent), controller.signal);
      setEntries((e) => [...e, ...result.entries]);
      if (result.page) {
        const next = result.page;
        setHistory((h) => push(h, next, "assistant"));
        setForm(requestToForm(next.request));
      }
    } catch (e) {
      const text = isAbort(e)
        ? "You stopped this answer."
        : e instanceof ChatError
          ? e.message
          : "The assistant couldn't answer. Please try again.";
      setEntries((en) => [...en, { kind: "error", text }]);
    } finally {
      setThinking(false);
      turn.current = null;
    }
  }

  function onSend(text: string) {
    const sent = addUserMessage(entries, text, page);
    setEntries(sent);
    void runTurn(sent);
  }

  return (
    <div className="app">
      <SearchControls
        form={form}
        onChange={(change: Partial<FormValues>) => setForm((f) => ({ ...f, ...change }))}
        onSearch={onSearch}
        onUndo={onUndo}
        canUndo={canUndo(history)}
        pending={pending}
        locked={pending || thinking}
      />
      <div className="layout">
        <main>
          <ResultsList results={page.results} />
        </main>
        <ChatPanel
          entries={entries}
          thinking={thinking}
          onStart={onStart}
          onSend={onSend}
          onStop={() => turn.current?.abort()}
          onRetry={() => void runTurn(entries)}
        />
      </div>
      {notice && <MessageBox notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}
