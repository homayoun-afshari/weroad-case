import type { ChatEntry } from "@/lib/chat/types";

interface Props {
  entries: ChatEntry[];
  onStart: () => void;
}

/** The chat. Before it starts it holds only the start button; after, the messages and errors. */
export function ChatPanel({ entries, onStart }: Props) {
  if (entries.length === 0) {
    return (
      <aside className="chat start" aria-label="Assistant">
        <button type="button" className="primary" onClick={onStart}>
          Ask the assistant
        </button>
      </aside>
    );
  }

  return (
    <aside className="chat" aria-label="Assistant">
      <ol className="messages">
        {entries.map((entry, i) =>
          entry.kind === "tools" || entry.kind === "page" ? null : (
            <li key={i} className={entry.kind}>
              {entry.text}
            </li>
          ),
        )}
      </ol>
    </aside>
  );
}
