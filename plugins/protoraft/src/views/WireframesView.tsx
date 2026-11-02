import {
  ArrowRight,
  Check,
  Maximize2,
  List,
  MessageSquareText,
  Network,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WireframeMap } from "../components/WireframeMap";
import { WireframeReview } from "../components/WireframeReview";
import { WorkspaceSubnav } from "../components/WorkspaceSubnav";
import type {
  DiscussionNote,
  FlowConnection,
  ProductWorkspaceView,
  PrototypeScreen,
  ScreenId,
  WireframeViewMode,
  WireframeRequestSummary,
} from "../types";

interface WireframesViewProps {
  screens: PrototypeScreen[];
  connections: FlowConnection[];
  discussions: DiscussionNote[];
  readOnly: boolean;
  activeWorkspaceView: ProductWorkspaceView;
  onWorkspaceViewChange: (view: ProductWorkspaceView) => void;
  canGenerate: boolean;
  requests: WireframeRequestSummary[];
  requestWarning: string;
  dispatching: string | null;
  focusScreen: { id: ScreenId } | null;
  onResultFocused: () => void;
  onGenerate: (source: ScreenId) => void;
  onRetryGeneration: (request: WireframeRequestSummary) => Promise<void>;
  onOpenResult: (screenId: ScreenId) => Promise<void>;
  onAddDiscussion: (screenId: ScreenId, body: string, noteId: string) => Promise<void>;
}

const productWorkspaceItems: Array<{
  id: ProductWorkspaceView;
  label: string;
}> = [
  { id: "wireframes", label: "Wireframes" },
  { id: "documents", label: "Documents" },
];

function StageBadge({ stage }: { stage: PrototypeScreen["stage"] }) {
  return (
    <span className={`stage-badge stage-badge--${stage}`}>
      {stage === "approved" && <Check size={12} />}
      {stage === "approved"
        ? "Approved"
        : stage === "review"
          ? "In review"
          : "Wireframe"}
    </span>
  );
}

export function WireframesView({
  screens,
  connections,
  discussions,
  readOnly,
  activeWorkspaceView,
  onWorkspaceViewChange,
  canGenerate,
  requests,
  requestWarning,
  dispatching,
  focusScreen,
  onResultFocused,
  onGenerate,
  onRetryGeneration,
  onOpenResult,
  onAddDiscussion,
}: WireframesViewProps) {
  const [viewMode, setViewMode] = useState<WireframeViewMode>("map");
  const [selectedId, setSelectedId] = useState<ScreenId>("story");
  const [reviewOpen, setReviewOpen] = useState(false);
  const selectedScreen = useMemo(
    () => screens.find((screen) => screen.id === selectedId) ?? screens[0],
    [screens, selectedId],
  );
  useEffect(() => {
    if (focusScreen) {
      setSelectedId(focusScreen.id);
      setReviewOpen(true);
      onResultFocused();
    }
  }, [focusScreen, onResultFocused]);

  const selectedNotes = useMemo(
    () => discussions.filter((note) => note.screenId === selectedScreen?.id),
    [discussions, selectedScreen?.id],
  );

  if (!selectedScreen) {
    return null;
  }

  return (
    <section className="workspace-view wireframes-view">
      <header className="view-header">
        <div className="view-heading">
          <WorkspaceSubnav
            label="Product workspace"
            active={activeWorkspaceView}
            items={productWorkspaceItems}
            onChange={onWorkspaceViewChange}
          />
          <div className="view-title-row">
            <h1>Wireframes</h1>
            <span className="title-meta">{screens.length} screens</span>
          </div>
        </div>
        <div className="view-actions">
          <div className="segmented-control" aria-label="Wireframe view">
            <button
              type="button"
              className={viewMode === "map" ? "is-active" : ""}
              aria-pressed={viewMode === "map"}
              onClick={() => setViewMode("map")}
            >
              <Network size={15} />
              Map
            </button>
            <button
              type="button"
              className={viewMode === "list" ? "is-active" : ""}
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              <List size={15} />
              List
            </button>
          </div>
          {!readOnly && (
            <button
              type="button"
              className="button button--primary"
              disabled={!canGenerate}
              title={canGenerate ? "Generate a wireframe from this screen" : "Open the project in Codex to generate wireframes"}
              onClick={() => onGenerate(selectedScreen.id)}
            >
              <Plus size={16} />
              Generate screen
            </button>
          )}
        </div>
      </header>

      {!readOnly && (requests.length > 0 || requestWarning) && (
        <details className="wireframe-requests" open>
          <summary>Wireframe requests ({requests.length})</summary>
          {requestWarning && <p role="status">{requestWarning}</p>}
          <ul>
            {requests.map((request) => (
              <li key={request.id}>
                <span><strong>{request.title}</strong> <code>{request.id}</code></span>
                <span role="status">
                  {{ queued: "Queued", claimed: "Generating", completed: request.availableOnCanvas === false ? "Result unavailable on this branch" : "Ready", failed: "Failed" }[request.status]}
                  {request.error && ` · ${request.error}`}
                </span>
                {request.status === "completed" && request.availableOnCanvas !== false && request.screenId && (
                  <button type="button" className="button button--secondary" onClick={() => void onOpenResult(request.screenId!)}>
                    Open result
                  </button>
                )}
                {(request.status === "failed" || request.status === "queued") && (
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={dispatching !== null}
                    onClick={() => void onRetryGeneration(request)}
                  >
                    {dispatching === request.id ? "Sending…" : request.status === "failed" ? "Retry" : "Send to Codex"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={`wireframe-workspace wireframe-workspace--${viewMode}`}>
        <div className="wireframe-main">
          {viewMode === "map" ? (
            <WireframeMap
              screens={screens}
              connections={connections}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <div className="wireframe-list-wrap">
              <table className="data-table wireframe-list">
                <thead>
                  <tr>
                    <th>Screen</th>
                    <th>Route</th>
                    <th>Status</th>
                    <th>States</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {screens.map((screen) => (
                    <tr
                      key={screen.id}
                      className={
                        screen.id === selectedId ? "is-selected" : undefined
                      }
                      onClick={() => setSelectedId(screen.id)}
                    >
                      <td>
                        <button
                          type="button"
                          className="screen-cell"
                          onClick={() => setSelectedId(screen.id)}
                        >
                          <img
                            src={screen.image}
                            alt={`${screen.title} wireframe`}
                          />
                          <span>
                            <strong>{screen.title}</strong>
                            <small>{screen.summary}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <code>{screen.route}</code>
                      </td>
                      <td>
                        <StageBadge stage={screen.stage} />
                      </td>
                      <td>{screen.states.length}</td>
                      <td>{screen.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="screen-inspector">
          <div className="inspector-heading">
            <h2>{selectedScreen.title}</h2>
            <StageBadge stage={selectedScreen.stage} />
          </div>

          <button
            type="button"
            className="inspector-image"
            onClick={() => setReviewOpen(true)}
          >
            <img
              src={selectedScreen.image}
              alt={`${selectedScreen.title} wireframe`}
            />
            <span>
              <Maximize2 size={16} />
              Open wireframe
            </span>
          </button>

          <div className="inspector-section">
            <h3>Purpose</h3>
            <p>{selectedScreen.purpose}</p>
          </div>

          <div className="inspector-section">
            <h3>Next</h3>
            <div className="transition-list">
              {selectedScreen.actions.map((action) => {
                const target = screens.find(
                  (screen) => screen.id === action.target,
                );
                return (
                  <button
                    key={`${action.label}-${action.target}`}
                    type="button"
                    onClick={() => setSelectedId(action.target)}
                  >
                    <span>
                      {action.label}
                      <small>{target?.title}</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="discussion-summary"
            onClick={() => setReviewOpen(true)}
          >
            <MessageSquareText size={17} />
            <span>
              <strong>Discussion</strong>
              <small>
                {selectedNotes.length === 0
                  ? "No notes yet"
                  : `${selectedNotes.length} note${selectedNotes.length === 1 ? "" : "s"}`}
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
        </aside>
      </div>

      <WireframeReview
        open={reviewOpen}
        screen={selectedScreen}
        notes={selectedNotes}
        readOnly={readOnly}
        onClose={() => setReviewOpen(false)}
        onAddNote={(body, noteId) => onAddDiscussion(selectedScreen.id, body, noteId)}
      />
    </section>
  );
}
