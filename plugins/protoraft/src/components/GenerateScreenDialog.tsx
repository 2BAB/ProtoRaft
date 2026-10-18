import { Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export interface GenerateScreenRequest {
  title: string;
  purpose: string;
  screenType: string;
}

interface GenerateScreenDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: GenerateScreenRequest) => Promise<void>;
}

export function GenerateScreenDialog({
  open,
  onClose,
  onSubmit,
}: GenerateScreenDialogProps) {
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [screenType, setScreenType] = useState("Mobile screen");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!purpose.trim()) {
      return;
    }
    setSubmitting(true);
    await onSubmit({
      title:
        title.trim() ||
        purpose.trim().split(/[.!?\n]/)[0]?.slice(0, 60) ||
        "Untitled screen",
      purpose: purpose.trim(),
      screenType,
    });
    setTitle("");
    setPurpose("");
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="dialog-layer" role="presentation">
      <button
        type="button"
        className="dialog-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-screen-title"
      >
        <header>
          <div>
            <span className="dialog-icon" aria-hidden="true">
              <Sparkles size={17} />
            </span>
            <h2 id="generate-screen-title">New wireframe</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            <span>What are we sketching?</span>
            <textarea
              autoFocus
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="A checkout confirmation that makes the next step obvious..."
              rows={6}
            />
          </label>
          <div className="dialog-inline-fields">
            <label>
              <span>Name (optional)</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Checkout complete"
              />
            </label>
            <label>
              <span>Format</span>
              <select
                value={screenType}
                onChange={(event) => setScreenType(event.target.value)}
              >
                <option>Mobile screen</option>
                <option>Desktop screen</option>
                <option>Tablet screen</option>
                <option>Overlay state</option>
              </select>
            </label>
          </div>
          <footer>
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={submitting || !purpose.trim()}
            >
              <Sparkles size={16} />
              {submitting ? "Starting" : "Generate wireframe"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
