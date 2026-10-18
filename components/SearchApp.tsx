"use client";

import { useEffect, useRef, useState } from "react";
import { ChatError, isAbort, postTurn } from "@/lib/chat/client";
import { reportedAfterSend, setDraft } from "@/lib/chat/controls";
import { searchEvent, undoEvent } from "@/lib/chat/events";
import { firstMessage } from "@/lib/chat/firstMessage";
import { DRAFT_WARNING, hasUnsentDraft } from "@/lib/chat/draft";
import { answerHandOver, isAsking, isFrozen } from "@/lib/chat/handover";
import { addUserMessage, recordEvent, withoutTrailingErrors } from "@/lib/chat/history";
import type { ChatEntry } from "@/lib/chat/types";
import { formToRequest, isDirty, requestToForm, type FormValues } from "@/lib/page/form";
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
  // The chat message being written. (Not the draft of the controls: that one is recorded as a page event.)
  const [chatDraft, setChatDraft] = useState("");
  const turn = useRef<AbortController | null>(null);
  // Whether the agent's last word on the controls is a draft that hasn't been searched
  const reported = useRef(false);

  const page = current(history);
  const frozen = isFrozen(entries);
  // A chat that has ended takes no more page events
  const chatStarted = entries.length > 0 && !frozen;
  const dirty = isDirty(form, page.request);
  // A chat message can be sent from the input unless it is locked (a turn runs, a question waits, the chat ended)
  const canSend = chatStarted && !thinking && !isAsking(entries);
  /** The search or the undo changed the page and left a chat message behind: say so (the message stays). */
  const warnAboutDraft = () => {
    if (hasUnsentDraft(chatDraft, canSend)) setNotice({ ...DRAFT_WARNING, kind: "warning" });
  };

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
      // The search ran as usual; if a chat message was left unsent, say so (the draft stays)
      warnAboutDraft();
      // The chat shows what the user did on the page, and the agent learns it with the next message.
      // The search consumes a draft of the controls: its event carries the request.
      reported.current = false;
      if (chatStarted) setEntries((e) => recordEvent(setDraft(e, null, false), searchEvent(next)));
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
    warnAboutDraft();
    // The controls now show the restored search, so a draft is gone
    reported.current = false;
    if (chatStarted) setEntries((e) => recordEvent(setDraft(e, null, false), undoEvent(page, restored, undone.reversed)));
  }

  /** The controls change as the user types; the chat keeps only their last state, if it differs from the page's search. */
  function onChange(change: Partial<FormValues>) {
    const next = { ...form, ...change };
    setForm(next);
    if (chatStarted) {
      const draft = isDirty(next, page.request) ? formToRequest(next) : null;
      setEntries((e) => setDraft(e, draft, reported.current));
    }
  }

  /** Puts the controls back to the page's search. The page history and the undo button are not involved. */
  function onDiscard() {
    setForm(requestToForm(page.request));
    if (chatStarted) setEntries((e) => setDraft(e, null, reported.current));
  }

  /** Starting the chat: the first message is written by code from the page as it is now. */
  function onStart() {
    const draft: ChatEntry[] = dirty ? setDraft([], formToRequest(form), false) : [];
    setEntries([{ kind: "assistant", text: firstMessage(page) }, ...draft]);
  }

  /** One turn: the agent answers, and if it searched, the page follows as the assistant's change. */
  async function runTurn(sent: ChatEntry[]) {
    const controller = new AbortController();
    turn.current = controller;
    setThinking(true);
    try {
      const result = await postTurn(withoutTrailingErrors(sent), page.results.map((r) => r.tripId), controller.signal);
      setEntries((e) => [...e, ...result.entries]);
      if (result.page) {
        const next = result.page;
        setHistory((h) => push(h, next, "assistant"));
        setForm(requestToForm(next.request));
        reported.current = false; // the agent replaced the controls, and knows it
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

  /** The user's answer to the hand-over question: yes closes the chat, no closes the question. */
  function onHandOver(answer: "yes" | "no") {
    setEntries((e) => answerHandOver(e, answer));
  }

  function onSend(text: string) {
    reported.current = reportedAfterSend(entries, reported.current);
    const sent = addUserMessage(entries, text, page);
    setEntries(sent);
    void runTurn(sent);
  }

  return (
    <div className="app">
      <SearchControls
        form={form}
        onChange={onChange}
        onSearch={onSearch}
        onUndo={onUndo}
        onDiscard={onDiscard}
        canUndo={canUndo(history)}
        dirty={dirty}
        pending={pending}
        locked={pending || thinking}
      />
      <div className="layout">
        <main>
          <ResultsList results={page.results} originalState={page.originalState} />
        </main>
        <ChatPanel
          entries={entries}
          draft={chatDraft}
          onDraft={setChatDraft}
          thinking={thinking}
          asking={isAsking(entries)}
          frozen={frozen}
          onStart={onStart}
          onSend={onSend}
          onStop={() => turn.current?.abort()}
          onRetry={() => void runTurn(entries)}
          onHandOver={onHandOver}
        />
      </div>
      {notice && <MessageBox notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}
