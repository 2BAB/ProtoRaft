import { Check, MessageSquareText, Send, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { randomHex } from "../client-id";
import type { DiscussionNote, PrototypeScreen } from "../types";

interface WireframeReviewProps {
  open: boolean;
  screen: PrototypeScreen;
  notes: DiscussionNote[];
  readOnly: boolean;
  onClose: () => void;
  onAddNote: (body: string, noteId: string) => Promise<void>;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function WireframeReview({
  open,
  screen,
  notes,
  readOnly,
  onClose,
  onAddNote,
}: WireframeReviewProps) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const pendingNote = useRef<{ id: string; body: string; screenId: string } | null>(null);

  useEffect(() => {
    setDraft("");
    setFailure("");
    pendingNote.current = null;
  }, [screen.id]);

  if (!open) {
    return null;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }
    setSaving(true);
    setFailure("");
    const body = draft.trim();
    if (pendingNote.current?.body !== body || pendingNote.current.screenId !== screen.id) {
      const id = `note_${randomHex(16)}`;
      pendingNote.current = { id, body, screenId: screen.id };
    }
    try {
      await onAddNote(body, pendingNote.current.id);
      setDraft("");
      pendingNote.current = null;
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Could not add the note. Your draft is still here.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wireframe-review-layer" role="presentation">
      <button
        type="button"
        className="wireframe-review-backdrop"
        aria-label="Close wireframe preview"
        onClick={onClose}
      />
      <section
        className="wireframe-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wireframe-review-title"
      >
        <header>
          <div>
            <span>Wireframe</span>
            <h2 id="wireframe-review-title">{screen.title}</h2>
          </div>
          <div className="wireframe-review-actions">
            <span className="wireframe-review-status">
              {screen.stage === "approved" && <Check size={15} />}
              {screen.stage === "approved"
                ? "Approved"
                : screen.stage === "review"
                  ? "In review"
                  : "Draft"}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Close wireframe preview"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="wireframe-review-body">
          <main className="wireframe-review-canvas">
            <img src={screen.image} alt={`${screen.title} wireframe`} />
            <p>{screen.purpose}</p>
          </main>

          <aside className="wireframe-discussion">
            <header>
              <MessageSquareText size={18} />
              <h3>Discussion</h3>
              <span>{notes.length}</span>
            </header>
            <div className="discussion-notes">
              {notes.length === 0 ? (
                <p className="discussion-empty">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <article key={note.id}>
                    <header>
                      <strong>{note.author}</strong>
                      <time dateTime={note.createdAt}>
                        {formatTime(note.createdAt)}
                      </time>
                    </header>
                    <p>{note.body}</p>
                  </article>
                ))
              )}
            </div>
            {!readOnly && (
              <form onSubmit={submit}>
                <textarea
                  value={draft}
                  disabled={saving}
                  rows={4}
                  placeholder="Record a decision or question"
                  aria-label="Discussion note"
                  onChange={(event) => setDraft(event.target.value)}
                />
                {failure && <p className="write-feedback" role="alert">{failure}</p>}
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={saving || !draft.trim()}
                >
                  <Send size={16} />
                  {saving ? "Adding" : "Add note"}
                </button>
              </form>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
