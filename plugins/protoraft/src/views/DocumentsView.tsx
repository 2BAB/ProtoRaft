import {
  Check,
  Edit3,
  Eye,
  FileText,
  Link2,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { MarkdownDocument } from "../components/MarkdownDocument";
import { WorkspaceSubnav } from "../components/WorkspaceSubnav";
import type {
  ProductDocument,
  DocumentWriteResult,
  DocumentDraft,
  ProductWorkspaceView,
  PrototypeScreen,
} from "../types";

interface DocumentsViewProps {
  documents: ProductDocument[];
  screens: PrototypeScreen[];
  readOnly: boolean;
  activeWorkspaceView: ProductWorkspaceView;
  onWorkspaceViewChange: (view: ProductWorkspaceView) => void;
  temporary: boolean;
  assets: Record<string, string>;
  drafts: Record<string, DocumentDraft>;
  setDrafts: Dispatch<SetStateAction<Record<string, DocumentDraft>>>;
  onSave: (id: string, content: string, revision?: string) => Promise<DocumentWriteResult>;
}

const productWorkspaceItems: Array<{
  id: ProductWorkspaceView;
  label: string;
}> = [
  { id: "wireframes", label: "Wireframes" },
  { id: "documents", label: "Documents" },
];

export function DocumentsView({
  documents,
  screens,
  readOnly,
  activeWorkspaceView,
  onWorkspaceViewChange,
  temporary,
  assets,
  drafts,
  setDrafts,
  onSave,
}: DocumentsViewProps) {
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? "");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const selectedDocument = useMemo(
    () =>
      documents.find((document) => document.id === selectedId) ?? documents[0],
    [documents, selectedId],
  );
  const [saving, setSaving] = useState(false);
  const [showLinked, setShowLinked] = useState(false);

  useEffect(() => {
    setShowLinked(false);
  }, [selectedDocument?.id]);

  useEffect(() => {
    if (readOnly) {
      setMode("preview");
    }
  }, [readOnly]);

  if (!selectedDocument) {
    return null;
  }

  const linkedScreens = screens.filter((screen) =>
    selectedDocument.screenIds.includes(screen.id),
  );
  const editing = readOnly ? undefined : drafts[selectedDocument.id];
  const draft = editing?.content ?? selectedDocument.content;
  const dirty = draft !== selectedDocument.content;
  const updateDraft = (content: string) => {
    setDrafts((current) => ({
      ...current,
      [selectedDocument.id]: { revision: selectedDocument.revision, ...current[selectedDocument.id], content },
    }));
  };

  const handleSave = async () => {
    if (!dirty || !editing || editing.latest) return;

    const id = selectedDocument.id;
    setSaving(true);
    try {
      const result = await onSave(id, draft, editing.revision);
      setDrafts((current) => {
        if (result.status === "conflict") {
          return { ...current, [id]: { ...editing, error: undefined, latest: result.latest } };
        }
        const updated = { ...current };
        delete updated[id];
        return updated;
      });
    } catch (error) {
      setDrafts((current) => ({
        ...current,
        [id]: { ...editing, error: error instanceof Error ? error.message : "Could not save your draft." },
      }));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="workspace-view documents-view">
      <header className="view-header">
        <div className="view-heading">
          <WorkspaceSubnav
            label="Product workspace"
            active={activeWorkspaceView}
            items={productWorkspaceItems}
            onChange={onWorkspaceViewChange}
          />
          <div className="view-title-row">
            <h1>Documents</h1>
            <span className="title-meta">
              {documents.length} {documents.length === 1 ? "file" : "files"}
            </span>
          </div>
        </div>
        {!readOnly && (
          <div className="view-actions">
            <div className="segmented-control" aria-label="Document mode">
              <button
                type="button"
                className={mode === "preview" ? "is-active" : ""}
                onClick={() => setMode("preview")}
              >
                <Eye size={15} />
                Preview
              </button>
              <button
                type="button"
                className={mode === "edit" ? "is-active" : ""}
                onClick={() => setMode("edit")}
              >
                <Edit3 size={15} />
                Edit
              </button>
            </div>
            <button
              type="button"
              className="button button--primary"
              disabled={!dirty || saving || Boolean(editing?.latest)}
              onClick={handleSave}
            >
              <Save size={15} />
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        )}
      </header>

      <div className="document-workspace">
        <aside className="document-list">
          {documents.map((document) => (
            <button
              key={document.id}
              type="button"
              className={document.id === selectedDocument.id ? "is-active" : ""}
              onClick={() => setSelectedId(document.id)}
            >
              <FileText size={17} />
              <span>
                <strong>{document.title}</strong>
                <small>{document.summary}</small>
              </span>
              <span
                className={`document-state document-state--${document.status}`}
                title={document.status}
              />
            </button>
          ))}
        </aside>

        <main className="document-canvas">
          <div className="document-meta">
            <span>
              <code>{selectedDocument.filename}</code>
              <small>{selectedDocument.updatedAt}</small>
            </span>
            <div className="document-meta-actions">
              <button
                type="button"
                className={showLinked ? "is-active" : ""}
                aria-pressed={showLinked}
                onClick={() => setShowLinked((current) => !current)}
              >
                <Link2 size={16} />
                {linkedScreens.length} linked screens
              </button>
              {!readOnly && (
                <span className="saved-state">
                  {dirty ? (
                    "Unsaved changes"
                  ) : (
                    <>
                      <Check size={15} /> {temporary ? "Preview only" : "Saved to repository"}
                    </>
                  )}
                </span>
              )}
            </div>
          </div>

          {showLinked && (
            <div className="linked-screen-strip">
              {linkedScreens.map((screen) => (
                <figure key={screen.id}>
                  <img src={screen.image} alt={`${screen.title} wireframe`} />
                  <figcaption>{screen.title}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {editing?.error && <p className="write-feedback" role="alert">{editing.error}</p>}
          {editing?.latest && (
            <section className="write-conflict" role="alert">
              <strong>The repository version changed. Your draft is still here.</strong>
              <details open>
                <summary>Latest repository version</summary>
                <pre>{editing.latest.content}</pre>
              </details>
              <button type="button" className="button button--secondary" onClick={() => {
                setDrafts((current) => ({
                  ...current,
                  [selectedDocument.id]: { content: editing.content, revision: editing.latest?.revision },
                }));
              }}>
                Keep draft and use latest revision
              </button>
            </section>
          )}
          {mode === "preview" ? (
            <div className="document-scroll">
              <MarkdownDocument
                content={draft}
                filename={selectedDocument.filename}
                assets={assets}
                documents={documents}
                onOpenDocument={setSelectedId}
              />
            </div>
          ) : (
            <textarea
              className="document-editor"
              value={draft}
              spellCheck
              aria-label={`${selectedDocument.title} Markdown`}
              disabled={saving}
              onChange={(event) => updateDraft(event.target.value)}
            />
          )}
        </main>

      </div>
    </section>
  );
}
