"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { cardLine } from "@/lib/chat/cards";
import type { ChatEntry } from "@/lib/chat/types";

interface Props {
  entries: ChatEntry[];
  /** A turn is running: "Thinking…" shows, and the input is locked. */
  thinking: boolean;
  onStart: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
}

/** The chat: the start button before it starts; after, the messages, the page cards, the input and the control buttons. */
export function ChatPanel({ entries, thinking, onStart, onSend, onStop, onRetry }: Props) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLOListElement>(null);

  // Keep the newest message in view
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [entries, thinking]);

  if (entries.length === 0) {
    return (
      <aside className="chat start" aria-label="Assistant">
        <button type="button" className="primary" onClick={onStart}>
          Ask the assistant
        </button>
      </aside>
    );
  }

  const canRetry = !thinking && entries[entries.length - 1].kind === "error";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");
    onSend(text);
  };

  return (
    <aside className="chat" aria-label="Assistant">
      <ol className="messages" ref={list}>
        {entries.map((entry, i) => {
          if (entry.kind === "tools") return null;
          if (entry.kind === "page") {
            return (
              <li key={i} className="card" aria-label="Page changes">
                {entry.events.map((event, k) => (
                  <p key={k}>{cardLine(event)}</p>
                ))}
              </li>
            );
          }
          return (
            <li key={i} className={entry.kind}>
              {entry.text}
            </li>
          );
        })}
        {thinking && <li className="assistant thinking">Thinking…</li>}
      </ol>
      <form className="chat-input" onSubmit={submit}>
        <input
          type="text"
          aria-label="Message"
          placeholder="Ask about these trips…"
          value={draft}
          disabled={thinking}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="primary" disabled={thinking || draft.trim() === ""}>
          Send
        </button>
        <button type="button" aria-label="Stop" title="Stop" onClick={onStop} disabled={!thinking}>
          ■
        </button>
        <button type="button" aria-label="Retry" title="Retry" onClick={onRetry} disabled={!canRetry}>
          ↻
        </button>
      </form>
    </aside>
  );
}
