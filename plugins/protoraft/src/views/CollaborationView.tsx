import { AlertTriangle, ArrowRight, Check, GitBranch, GitCommit, RefreshCw, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import type { BranchChange, BranchSnapshot } from "../types";

interface ComparisonImages {
  baseImage?: string;
  compareImage?: string;
}

interface CollaborationViewProps {
  branches: BranchSnapshot[];
  readOnly: boolean;
  onScan?: () => Promise<void>;
  onImages?: (change: BranchChange) => Promise<ComparisonImages>;
  onResolve?: (change: BranchChange) => Promise<void>;
  onSaveDecision?: (change: BranchChange, decision: string) => Promise<void>;
}

export function CollaborationView({
  branches,
  readOnly,
  onScan,
  onImages,
  onResolve,
  onSaveDecision,
}: CollaborationViewProps) {
  const [base, compare] = branches;
  const [selectedPath, setSelectedPath] = useState("");
  const selected = compare?.changes.find((change) => change.path === selectedPath)
    ?? compare?.changes.find((change) => change.decisionRequired)
    ?? compare?.changes.find((change) => change.kind === "conflict")
    ?? compare?.changes[0];
  const [scanning, setScanning] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<(ComparisonImages & { key: string }) | null>(null);
  const [imageError, setImageError] = useState("");
  const imagePath = selected?.image ? selected.path : undefined;
  const imageKey = imagePath && `${base?.commit}:${compare?.commit}:${imagePath}`;

  useEffect(() => {
    if (!imageKey || !imagePath || !onImages) return;
    const change = compare?.changes.find((item) => item.path === imagePath);
    if (!change) return;

    let active = true;
    setImageError("");
    void onImages(change).then((result) => {
      if (active) setImages({ ...result, key: imageKey });
    }).catch(() => {
      if (active) setImageError("Could not load the committed images.");
    });
    return () => { active = false; };
  }, [imageKey, imagePath, compare, onImages]);

  const scan = async () => {
    if (!onScan) return;
    setError("");
    setScanning(true);
    try {
      await onScan();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not scan the branches.");
    } finally {
      setScanning(false);
    }
  };

  const saveDecision = async (change: BranchChange) => {
    const draft = drafts[change.path];
    if (!draft?.trim() || !onSaveDecision) return;
    setSaving(true);
    setError("");
    try {
      await onSaveDecision(change, draft);
      setDrafts((current) => {
        const remaining = { ...current };
        delete remaining[change.path];
        return remaining;
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the decision.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="workspace-view collaboration-view">
      <header className="view-header">
        <div>
          <div className="view-title-row">
            <h1>{readOnly ? "Branch review" : "Collaboration"}</h1>
            <span className="title-meta">{compare?.changes.length ?? 0} changes</span>
          </div>
          {compare?.reviewTitle && <p>{compare.reviewTitle}</p>}
        </div>
        {onScan && compare && (
          <button type="button" className="button button--secondary" disabled={scanning} onClick={() => void scan()}>
            {scanning ? <RefreshCw className="spin" size={15} /> : <ScanSearch size={15} />}
            {scanning ? "Scanning…" : "Scan branches"}
          </button>
        )}
      </header>
      {error && <p className="write-feedback" role="alert">{error}</p>}

      {base && compare ? (
        <>
          <div className="branch-summary">
            {[base, compare].map((branch, index) => (
              <section key={branch.name}>
                {index > 0 && <ArrowRight size={16} aria-hidden="true" />}
                <span className="branch-icon"><GitBranch size={17} /></span>
                <div>
                  <small>{index === 0 ? "Base" : "Compare"}</small>
                  <strong>{branch.name}</strong>
                  <span title={branch.fullCommit}><GitCommit size={13} /> {branch.commit} · {branch.author}</span>
                </div>
              </section>
            ))}
            <div className="change-count">
              <strong>{compare.changes.filter((change) => change.decisionRequired && !change.decision).length}</strong>
              <span>product decisions pending</span>
            </div>
          </div>
          {selected ? (
            <div className="collaboration-workspace">
              <aside className="change-list" aria-label="Changed artifacts">
                {compare.changes.map((change) => (
                  <button key={change.path} type="button" className={change.path === selected.path ? "is-active" : ""}
                    onClick={() => { setSelectedPath(change.path); setError(""); }}>
                    <span className={`change-kind change-kind--${change.kind}`}>{change.kind === "conflict" ? "!" : change.kind[0].toUpperCase()}</span>
                    <span><strong>{change.path.split("/").at(-1)}</strong><small>{change.path}</small></span>
                  </button>
                ))}
              </aside>
              <div className="comparison-panel">
                <header className="comparison-heading">
                  <div><h2>{selected.path}</h2><p>{selected.summary}</p></div>
                  <span className={`comparison-status comparison-status--${selected.kind}`}>
                    {selected.kind === "conflict"
                      ? <><AlertTriangle size={14} /> Possible Git conflict</>
                      : <><Check size={14} /> No Git conflict flagged</>}
                  </span>
                </header>
                <div className="comparison-versions">
                  {([base, compare] as const).map((branch, index) => {
                    const image = index === 0
                      ? selected.baseImage ?? (images?.key === imageKey ? images?.baseImage : undefined)
                      : selected.compareImage ?? (images?.key === imageKey ? images?.compareImage : undefined);
                    const content = index === 0 ? selected.baseContent : selected.compareContent;
                    return (
                      <section key={branch.name} aria-label={branch.name}>
                        <h3>{branch.name} <code>{branch.commit}</code></h3>
                        {image ? <img src={image} alt={`${selected.path} on ${branch.name}`} />
                          : <pre className="branch-content">{selected.image && onImages && images?.key !== imageKey
                            ? imageError || "Loading image…" : content || "No preview available."}</pre>}
                      </section>
                    );
                  })}
                </div>
                {(selected.decisionRequired || selected.decision) && (
                  <section className="review-decision">
                    <h3>{selected.decision ? "Product decision recorded" : "Product decision pending"}</h3>
                    {selected.decision && <p>{selected.decision}</p>}
                    {selected.recommendation && <p>{selected.recommendation}</p>}
                    {Boolean(selected.resolutionCriteria?.length) && (
                      <ul>{selected.resolutionCriteria?.map((item) => <li key={item}>{item}</li>)}</ul>
                    )}
                    {!readOnly && onSaveDecision && compare.decisionRevision && (
                      <label>
                        <span>Record product decision</span>
                        <textarea maxLength={2000} value={drafts[selected.path] ?? selected.decision ?? ""}
                          onChange={(event) => setDrafts({ ...drafts, [selected.path]: event.target.value })} />
                        <button type="button" className="button button--secondary"
                          disabled={saving || !drafts[selected.path]?.trim()} onClick={() => void saveDecision(selected)}>
                          {saving ? "Saving…" : "Save decision"}
                        </button>
                      </label>
                    )}
                  </section>
                )}
                {onResolve && (selected.kind === "conflict" || selected.decisionRequired) && (
                  <button type="button" className="button button--secondary" onClick={() => void onResolve(selected)}>
                    Discuss with Codex
                  </button>
                )}
              </div>
            </div>
          ) : <p>No changes between these branches.</p>}
        </>
      ) : <p>No comparison branch is available.</p>}
    </section>
  );
}
