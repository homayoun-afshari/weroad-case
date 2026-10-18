"use client";

import { useEffect, useState } from "react";
import { formToRequest, requestToForm, type FormValues } from "@/lib/page/form";
import { firstMessage } from "@/lib/chat/firstMessage";
import type { ChatEntry } from "@/lib/chat/types";
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

  const page = current(history);

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
      setHistory((h) => push(h, body as PageState, "user"));
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
    setHistory(undone.history);
    setForm(requestToForm(current(undone.history).request));
  }

  /** Starting the chat: the first message is written by code from the page as it is now. */
  function onStart() {
    setEntries([{ kind: "assistant", text: firstMessage(page) }]);
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
      />
      <div className="layout">
        <main>
          <ResultsList results={page.results} />
        </main>
        <ChatPanel entries={entries} onStart={onStart} />
      </div>
      {notice && <MessageBox notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}
