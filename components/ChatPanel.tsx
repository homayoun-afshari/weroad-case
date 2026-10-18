"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { cardLine } from "@/lib/chat/cards";
import type { ChatEntry } from "@/lib/chat/types";

interface Props {
  entries: ChatEntry[];
  /** A turn is running: "Thinking…" shows, and the input is locked. */
  thinking: boolean;
  /** The hand-over question waits for an answer: the input stays locked until it has one. */
  asking: boolean;
  /** The user asked for a human agent: the chat is closed. */
  frozen: boolean;
  onStart: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
  onHandOver: (answer: "yes" | "no") => void;
}

/** The chat: the start button before it starts; after, the messages, the page cards, the input and the control buttons. */
export function ChatPanel({ entries, thinking, asking, frozen, onStart, onSend, onStop, onRetry, onHandOver }: Props) {
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

  const locked = thinking || asking || frozen;
  const canRetry = !thinking && !frozen && entries[entries.length - 1].kind === "error";
  const placeholder = frozen
    ? "This chat is closed"
    : asking
      ? "Yes or No above"
      : "Ask about these trips…";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || locked) return;
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
          if (entry.kind === "handover") {
            return (
              <li key={i} className="handover">
                {entry.answer === "asked" ? (
                  <>
                    <p>Do you want to connect to a human agent?</p>
                    <div className="choices">
                      <button type="button" className="primary" onClick={() => onHandOver("yes")}>
                        Yes
                      </button>
                      <button type="button" onClick={() => onHandOver("no")}>
                        No
                      </button>
                    </div>
                  </>
                ) : entry.answer === "yes" ? (
                  <p>You said yes to a human agent. This chat is closed.</p>
                ) : (
                  <p>You said no to a human agent.</p>
                )}
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
          placeholder={placeholder}
          value={draft}
          disabled={locked}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="primary" disabled={locked || draft.trim() === ""}>
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
