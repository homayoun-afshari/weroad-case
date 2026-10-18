/** The chat. Before it starts it holds only the start button; the conversation comes in block 3. */
export function ChatPanel() {
  return (
    <aside className="chat" aria-label="Assistant">
      <button type="button" className="primary" disabled>
        Ask the assistant
      </button>
    </aside>
  );
}
