import { ScanLine } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

export interface PreviewChangeRequest {
  moduleId: string;
  moduleLabel: string;
  comment: string;
}

interface ReviewablePreviewProps {
  children: ReactNode;
  onSend: (request: PreviewChangeRequest) => Promise<boolean>;
}

const moduleSelector = "[data-review-target]";

function reviewTarget(target: EventTarget) {
  return target instanceof Element ? target.closest<HTMLElement>(moduleSelector) : null;
}

export function ReviewablePreview({ children, onSend }: ReviewablePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [targets, setTargets] = useState<HTMLElement[] | null>(null);
  const [hovered, setHovered] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    hovered?.setAttribute("data-review-hovered", "");
    return () => hovered?.removeAttribute("data-review-hovered");
  }, [hovered]);

  useEffect(() => {
    selected?.setAttribute("data-review-selected", "");
    return () => selected?.removeAttribute("data-review-selected");
  }, [selected]);

  function closeReview() {
    setTargets(null);
    setHovered(null);
    setSelected(null);
    setComment("");
    setError("");
    buttonRef.current?.focus();
  }

  async function sendChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const moduleId = selected?.dataset.reviewTarget;
    const moduleLabel = selected?.dataset.reviewLabel;
    if (!moduleId || !moduleLabel || !comment.trim() || sending) return;

    setSending(true);
    setError("");
    try {
      const sent = await onSend({ moduleId, moduleLabel, comment: comment.trim() });
      if (!sent) throw new Error("Codex did not accept the request.");
      closeReview();
    } catch {
      setError("Could not send to Codex. Your draft is still here. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="reviewable-preview"
      onKeyDown={(event) => {
        if (event.key === "Escape" && targets && !sending) {
          event.stopPropagation();
          closeReview();
        }
      }}
    >
      <div className="preview-feedback-controls">
        <button
          ref={buttonRef}
          type="button"
          className="button button--secondary preview-feedback-toggle"
          aria-pressed={targets !== null}
          aria-disabled={sending}
          onClick={() => {
            if (sending) return;
            if (targets) closeReview();
            else if (previewRef.current) {
              setTargets([...previewRef.current.querySelectorAll<HTMLElement>(moduleSelector)]);
            }
          }}
        >
          <ScanLine size={16} aria-hidden="true" />
          Ask for changes
        </button>
        {targets && (
          <form className="preview-feedback-form" onSubmit={sendChange}>
            <p>Select a module in the preview or choose it below.</p>
            <label>
              Module
              <select
                autoFocus
                value={selected?.dataset.reviewTarget ?? ""}
                onChange={(event) => {
                  const id = event.currentTarget.value;
                  setSelected(targets.find((target) => target.dataset.reviewTarget === id) ?? null);
                }}
                disabled={sending}
              >
                <option value="">Choose a module</option>
                {targets.map((target) => (
                  <option key={target.dataset.reviewTarget} value={target.dataset.reviewTarget}>
                    {target.dataset.reviewLabel}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <>
                <label>
                  What should change?
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.currentTarget.value)}
                    rows={2}
                    disabled={sending}
                  />
                </label>
                {error && <p className="write-feedback" role="alert">{error}</p>}
                <div className="preview-feedback-actions">
                  <button type="button" className="button button--secondary" onClick={closeReview} disabled={sending}>
                    Cancel
                  </button>
                  <button type="submit" className="button button--primary" disabled={!comment.trim() || sending}>
                    {sending ? "Sending…" : "Send to Codex"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>

      <div
        ref={previewRef}
        data-reviewing={targets ? "" : undefined}
        onPointerOver={targets && !sending ? (event) => setHovered(reviewTarget(event.target)) : undefined}
        onPointerLeave={targets ? () => setHovered(null) : undefined}
        onClickCapture={targets ? (event) => {
          event.preventDefault();
          event.stopPropagation();
          const target = reviewTarget(event.target);
          if (target && !sending) {
            setHovered(null);
            setSelected(target);
          }
        } : undefined}
        onKeyDownCapture={targets ? (event) => {
          // A native slider changes on keydown before a click can be intercepted.
          if (event.target instanceof HTMLInputElement && event.key !== "Tab" && event.key !== "Escape") {
            event.preventDefault();
          }
        } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
