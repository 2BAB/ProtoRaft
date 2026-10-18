import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileDiff,
  GitBranch,
  GitCommit,
  RefreshCw,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { BranchChange, BranchSnapshot } from "../types";

interface CollaborationViewProps {
  branches: BranchSnapshot[];
  onResolve: (change: BranchChange) => Promise<void>;
  onNotify: (message: string) => void;
}

export function CollaborationView({
  branches,
  onResolve,
  onNotify,
}: CollaborationViewProps) {
  const base = branches[0];
  const compare = branches[1];
  const [selectedPath, setSelectedPath] = useState(
    compare?.changes.find((change) => change.kind === "conflict")?.path ??
      compare?.changes[0]?.path ??
      "",
  );
  const [branchTab, setBranchTab] = useState<"main" | "feature">("main");
  const [scanning, setScanning] = useState(false);

  const effectivePath = compare?.changes.some(
    (change) => change.path === selectedPath,
  )
    ? selectedPath
    : (compare?.changes[0]?.path ?? "");
  const selectedChange = compare?.changes.find(
    (change) => change.path === effectivePath,
  );

  const runScan = () => {
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      const conflictCount =
        compare?.changes.filter((change) => change.kind === "conflict").length ??
        0;
      onNotify(
        conflictCount === 0
          ? "Scan complete: no decisions required."
          : `Scan complete: ${conflictCount} decision${conflictCount === 1 ? "" : "s"} require review.`,
      );
    }, 650);
  };

  const header = (
    <header className="view-header">
      <div className="view-title-row">
        <h1>Collaboration</h1>
        <span className="title-meta">
          {compare?.changes.length ?? 0} changes
        </span>
      </div>
      <button
        type="button"
        className="button button--secondary"
        onClick={runScan}
        disabled={scanning || !compare}
      >
        {scanning ? (
          <RefreshCw className="spin" size={15} />
        ) : (
          <ScanSearch size={15} />
        )}
        {scanning ? "Scanning" : "Scan conflicts"}
      </button>
    </header>
  );

  if (!base || !compare || !selectedChange) {
    return (
      <section className="workspace-view collaboration-view">
        {header}
        <div className="collaboration-empty">
          <span>
            <GitBranch size={22} />
          </span>
          <h2>{base ? "No comparison branch" : "No Git branches found"}</h2>
          <p>
            {base
              ? `${base.name} is the only branch available in this workspace.`
              : "Connect a Git repository to compare prototype changes."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-view collaboration-view">
      {header}

      <div className="branch-summary">
        <section>
          <span className="branch-icon">
            <GitBranch size={17} />
          </span>
          <div>
            <small>Base</small>
            <strong>{base.name}</strong>
            <span>
              <GitCommit size={13} /> {base.commit} · {base.author}
            </span>
          </div>
        </section>
        <ArrowRight size={18} aria-hidden="true" />
        <section>
          <span className="branch-icon branch-icon--accent">
            <GitBranch size={17} />
          </span>
          <div>
            <small>Compare</small>
            <strong>{compare.name}</strong>
            <span>
              <GitCommit size={13} /> {compare.commit} · {compare.author}
            </span>
          </div>
        </section>
        <div className="change-count">
          <strong>{compare.changes.length}</strong>
          <span>changed artifacts</span>
        </div>
      </div>

      <div className="collaboration-workspace">
        <aside className="change-list">
          {compare.changes.map((change) => (
            <button
              key={change.path}
              type="button"
              className={change.path === effectivePath ? "is-active" : ""}
              onClick={() => setSelectedPath(change.path)}
            >
              <span className={`change-kind change-kind--${change.kind}`}>
                {change.kind === "conflict" ? "!" : "M"}
              </span>
              <span>
                <strong>{change.path.split("/").at(-1)}</strong>
                <small>{change.path}</small>
              </span>
            </button>
          ))}
        </aside>

        <main className="comparison-panel">
          <header className="comparison-heading">
            <div>
              <h2>{selectedChange.path}</h2>
              <p>{selectedChange.summary}</p>
            </div>
            <span
              className={`comparison-status comparison-status--${selectedChange.kind}`}
            >
              {selectedChange.kind === "conflict" ? (
                <>
                  <AlertTriangle size={14} /> Decision needed
                </>
              ) : (
                <>
                  <Check size={14} /> Mergeable
                </>
              )}
            </span>
          </header>

          {selectedChange.kind === "conflict" ? (
            <>
              <div className="branch-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={branchTab === "main"}
                  className={branchTab === "main" ? "is-active" : ""}
                  onClick={() => setBranchTab("main")}
                >
                  {base.name}
                  <code>{base.commit}</code>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={branchTab === "feature"}
                  className={branchTab === "feature" ? "is-active" : ""}
                  onClick={() => setBranchTab("feature")}
                >
                  {compare.name}
                  <code>{compare.commit}</code>
                </button>
              </div>
              <pre className="branch-content">
                {branchTab === "main"
                  ? (selectedChange.baseContent ??
                    `[Preview unavailable on ${base.name}]`)
                  : (selectedChange.compareContent ??
                    `[Preview unavailable on ${compare.name}]`)}
              </pre>
              <section className="merge-recommendation">
                <span>
                  <Sparkles size={16} />
                </span>
                <div>
                  <strong>
                    {selectedChange.recommendation
                      ? "Recommended resolution"
                      : "Review with Codex"}
                  </strong>
                  <p>
                    {selectedChange.recommendation ??
                      "Inspect both branch versions in context, identify the product decision, and propose the smallest coherent resolution."}
                  </p>
                </div>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => onResolve(selectedChange)}
                >
                  Ask Codex to resolve
                </button>
              </section>
            </>
          ) : (
            <div className="mergeable-change">
              <FileDiff size={24} />
              <h3>Clean structural change</h3>
              <p>{selectedChange.summary}</p>
              <div>
                <span>
                  <small>Base</small>
                  {base.commit}
                </span>
                <ArrowRight size={16} />
                <span>
                  <small>Compare</small>
                  {compare.commit}
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
