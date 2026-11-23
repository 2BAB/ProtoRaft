import { List, Network } from "lucide-react";
import { useState } from "react";
import { MorrowPreview } from "../components/MorrowPreview";
import { ReviewablePreview, type PreviewChangeRequest } from "../components/ReviewablePreview";
import { ScreenMap } from "../components/ScreenMap";
import { WorkspaceSubnav } from "../components/WorkspaceSubnav";
import type {
  DesignWorkspaceView,
  FlowConnection,
  PrototypeScreen,
  ScreenId,
} from "../types";

interface HiFiViewProps {
  screens: PrototypeScreen[];
  connections: FlowConnection[];
  activeScreen: ScreenId;
  activeWorkspaceView: DesignWorkspaceView;
  onWorkspaceViewChange: (view: DesignWorkspaceView) => void;
  onScreenChange: (id: ScreenId) => void;
  onRequestChange?: (screen: PrototypeScreen, request: PreviewChangeRequest) => Promise<boolean>;
}

type ScreenViewMode = "map" | "list";

const designWorkspaceItems: Array<{
  id: DesignWorkspaceView;
  label: string;
}> = [
  { id: "system", label: "System" },
  { id: "preview", label: "Screens" },
];

export function HiFiView({
  screens,
  connections,
  activeScreen,
  activeWorkspaceView,
  onWorkspaceViewChange,
  onScreenChange,
  onRequestChange,
}: HiFiViewProps) {
  const [viewMode, setViewMode] = useState<ScreenViewMode>("map");
  const screen = screens.find((item) => item.id === activeScreen);
  const reviewable = screen && onRequestChange;
  const preview = <MorrowPreview activeScreen={activeScreen} onScreenChange={onScreenChange} />;

  return (
    <section className="workspace-view hifi-view">
      <header className="view-header">
        <div className="view-heading">
          <WorkspaceSubnav
            label="Design workspace"
            active={activeWorkspaceView}
            items={designWorkspaceItems}
            onChange={onWorkspaceViewChange}
          />
          <div className="view-title-row">
            <h1>Screen Preview</h1>
            <span className="title-meta">{screens.length} routes</span>
          </div>
        </div>
        <div className="view-actions">
          <div className="segmented-control" aria-label="Screen view">
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
        </div>
      </header>

      <div className={`hifi-workspace hifi-workspace--${viewMode}`}>
        {viewMode === "map" ? (
          <div className="screen-map-stage">
            <ScreenMap
              screens={screens}
              connections={connections}
              selectedId={activeScreen}
              onSelect={onScreenChange}
            />
          </div>
        ) : (
          <aside className="route-list">
            {screens.map((screen) => (
              <button
                key={screen.id}
                type="button"
                className={screen.id === activeScreen ? "is-active" : ""}
                onClick={() => onScreenChange(screen.id)}
              >
                <span>
                  <strong>{screen.title}</strong>
                  <code>{screen.route}</code>
                </span>
              </button>
            ))}
          </aside>
        )}

        <main
          className={`phone-stage ${
            viewMode === "map" ? "phone-stage--map" : ""
          }${reviewable ? " phone-stage--reviewable" : ""}`}
        >
          {screen && onRequestChange ? (
            <ReviewablePreview key={activeScreen} onSend={(request) => onRequestChange(screen, request)}>
              {preview}
            </ReviewablePreview>
          ) : preview}
        </main>
      </div>
    </section>
  );
}
