import {
  Box,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  Eye,
  ListChecks,
  Pause,
  Play,
  RefreshCw,
  Repeat2,
  SlidersHorizontal,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import editorialImage from "../assets/morrow/editorial-bridge.webp";
import { WorkspaceSubnav } from "../components/WorkspaceSubnav";
import type {
  ComponentContract,
  DesignToken,
  DesignWorkspaceView,
} from "../types";

interface DesignSystemViewProps {
  tokens: DesignToken[];
  components: ComponentContract[];
  readOnly: boolean;
  activeWorkspaceView: DesignWorkspaceView;
  onWorkspaceViewChange: (view: DesignWorkspaceView) => void;
  onSyncCore: (platform: "ios" | "android" | "all") => Promise<void> | void;
}

type DesignTab = "tokens" | "components" | "native";

const designWorkspaceItems: Array<{
  id: DesignWorkspaceView;
  label: string;
}> = [
  { id: "system", label: "System" },
  { id: "preview", label: "Screens" },
];

function ComponentSample({ component }: { component: ComponentContract }) {
  if (component.id === "publication-header") {
    return (
      <div className="component-demo publication-header-demo">
        <button type="button" aria-label="Open menu">
          <span />
          <span />
        </button>
        <strong>Morrow</strong>
        <span>July 28</span>
      </div>
    );
  }

  if (component.id === "topic-filter") {
    return (
      <div className="component-demo topic-filter-demo">
        <button type="button" className="is-active">
          Today
        </button>
        <button type="button">Ideas</button>
        <button type="button">Culture</button>
      </div>
    );
  }

  if (component.id === "story-card") {
    return (
      <article className="component-demo story-card-demo">
        <img src={editorialImage} alt="" />
        <small>CITIES</small>
        <h3>A City Learning to Listen</h3>
        <p>What the morning commute can tell us about public life.</p>
        <span>8 min read</span>
      </article>
    );
  }

  if (component.id === "reading-toolbar") {
    return (
      <div className="component-demo reading-toolbar-demo">
        <span>42%</span>
        <div>
          <button type="button" aria-label="Decrease text size">
            A
          </button>
          <button type="button" aria-label="Increase text size">
            <strong>A</strong>
          </button>
          <button type="button" aria-label="Reading settings">
            <SlidersHorizontal size={17} />
          </button>
        </div>
      </div>
    );
  }

  if (component.id === "audio-player") {
    return (
      <div className="component-demo audio-player-demo">
        <img src={editorialImage} alt="" />
        <div>
          <small>NOW PLAYING</small>
          <strong>A City Learning to Listen</strong>
          <span className="demo-progress">
            <i />
          </span>
        </div>
        <button type="button" aria-label="Pause">
          <Pause size={18} fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="component-demo bottom-nav-demo">
      <button type="button" className="is-active">
        <CircleDot size={19} />
        Today
      </button>
      <button type="button">
        <Play size={19} />
        Listen
      </button>
      <button type="button">
        <Box size={19} />
        Saved
      </button>
    </div>
  );
}

export function DesignSystemView({
  tokens,
  components,
  readOnly,
  activeWorkspaceView,
  onWorkspaceViewChange,
  onSyncCore,
}: DesignSystemViewProps) {
  const [tab, setTab] = useState<DesignTab>("tokens");
  const [selectedComponentId, setSelectedComponentId] = useState(
    components[2]?.id ?? components[0]?.id,
  );
  const selectedComponent = useMemo(
    () =>
      components.find((component) => component.id === selectedComponentId) ??
      components[0],
    [components, selectedComponentId],
  );

  useEffect(() => {
    if (readOnly && tab === "native") {
      setTab("tokens");
    }
  }, [readOnly, tab]);

  return (
    <section className="workspace-view design-system-view">
      <header className="view-header">
        <div className="view-heading">
          <WorkspaceSubnav
            label="Design workspace"
            active={activeWorkspaceView}
            items={designWorkspaceItems}
            onChange={onWorkspaceViewChange}
          />
          <div className="view-title-row">
            <h1>Design system</h1>
            <span className="title-meta">
              {tokens.length} tokens · {components.length} components
            </span>
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => void onSyncCore("all")}
          >
            <RefreshCw size={16} />
            Sync core
          </button>
        )}
      </header>

      <div className="design-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "tokens"}
          className={tab === "tokens" ? "is-active" : ""}
          onClick={() => setTab("tokens")}
        >
          Tokens
          <span>{tokens.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "components"}
          className={tab === "components" ? "is-active" : ""}
          onClick={() => setTab("components")}
        >
          Components
          <span>{components.length}</span>
        </button>
        {!readOnly && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "native"}
            className={tab === "native" ? "is-active" : ""}
            onClick={() => setTab("native")}
          >
            Native sync
          </button>
        )}
      </div>

      {tab === "tokens" && (
        <div className="token-table-wrap">
          <table className="data-table token-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Group</th>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.path}>
                  <td>
                    <span className="token-name">
                      {token.swatch && (
                        <i style={{ backgroundColor: token.swatch }} />
                      )}
                      <code>{token.path}</code>
                    </span>
                  </td>
                  <td>{token.group}</td>
                  <td>
                    <code>{token.value}</code>
                  </td>
                  <td>{token.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "components" && selectedComponent && (
        <div className="component-workspace">
          <div className="component-list">
            {components.map((component) => (
              <button
                key={component.id}
                type="button"
                className={
                  component.id === selectedComponent.id ? "is-active" : ""
                }
                onClick={() => setSelectedComponentId(component.id)}
              >
                <span>
                  <strong>{component.name}</strong>
                  <small>
                    {component.category} · {component.variants.length} variants
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <main className="component-detail">
            <header>
              <span>{selectedComponent.category}</span>
              <h2>{selectedComponent.name}</h2>
              <p>{selectedComponent.description}</p>
            </header>
            <div className="component-preview">
              <ComponentSample component={selectedComponent} />
            </div>
            <div className="contract-grid">
              <div>
                <h3>Variants</h3>
                {selectedComponent.variants.map((variant) => (
                  <span key={variant}>{variant}</span>
                ))}
              </div>
              <div>
                <h3>States</h3>
                {selectedComponent.states.map((state) => (
                  <span key={state}>{state}</span>
                ))}
              </div>
              <div>
                <h3>Platforms</h3>
                {selectedComponent.platforms.map((platform) => (
                  <span key={platform}>
                    <Check size={12} /> {platform}
                  </span>
                ))}
              </div>
            </div>
          </main>
        </div>
      )}

      {tab === "native" && (
        <div className="native-handoff">
          <header>
            <span className="native-icon">
              <Code2 size={19} />
            </span>
            <div>
              <h2>Sync the shared core</h2>
              <p>
                Send approved tokens, components, routes, states, and visual
                references into a native repository without copying web code.
              </p>
            </div>
          </header>

          <section className="native-core-summary">
            <h3>Shared core</h3>
            <ul>
              <li>
                <Check size={16} /> Design tokens
              </li>
              <li>
                <Check size={16} /> Component contracts
              </li>
              <li>
                <Check size={16} /> Routes and states
              </li>
              <li>
                <Check size={16} /> Accessibility intent
              </li>
              <li>
                <Check size={16} /> Visual references
              </li>
            </ul>
          </section>

          <section className="platform-sync">
            <h3>Target codebase</h3>
            <button type="button" onClick={() => void onSyncCore("ios")}>
              <strong>iOS</strong>
              <span>Map the core into the target SwiftUI project</span>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => void onSyncCore("android")}>
              <strong>Android</strong>
              <span>Map the core into the target Compose project</span>
              <ChevronRight size={18} />
            </button>
          </section>

          <section className="agent-workflow">
            <h3>Agent workflow</h3>
            <div>
              <span>
                <WandSparkles size={18} />
                <strong>Convert</strong>
                <small>Map neutral contracts to native patterns</small>
              </span>
              <span>
                <Eye size={18} />
                <strong>Visual verify</strong>
                <small>Compare implementation captures to references</small>
              </span>
              <span>
                <ListChecks size={18} />
                <strong>Assign</strong>
                <small>Split work by screen and shared component</small>
              </span>
              <span>
                <Repeat2 size={18} />
                <strong>Loop</strong>
                <small>Build, inspect, correct, and repeat</small>
              </span>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
