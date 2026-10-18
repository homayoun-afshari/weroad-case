/** How long a message stays before it closes by itself. */
export const MESSAGE_BOX_MS = 6000;

export interface Notice {
  title: string;
  body: string;
}

/** Errors and warnings from the search controls, at the bottom of the app. */
export function MessageBox({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div className="message-box" role="alert">
      <div>
        <strong>{notice.title}</strong>
        <p>{notice.body}</p>
      </div>
      <button type="button" aria-label="Close message" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
