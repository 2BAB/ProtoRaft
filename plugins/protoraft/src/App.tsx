import {
  CheckCircle2,
  ChevronDown,
  Globe2,
  GitBranch,
  Settings,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  connectProtoRaftApp,
  type BridgeStatus,
  type ProtoRaftBridge,
} from "./bridge";
import {
  GenerateScreenDialog,
  type GenerateScreenRequest,
} from "./components/GenerateScreenDialog";
import { MorrowPreview } from "./components/MorrowPreview";
import {
  SettingsDialog,
  type ScheduledReviewRequest,
} from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { morrowProject } from "./data/morrow";
import type {
  BranchChange,
  DesignWorkspaceView,
  DisplayMode,
  DiscussionNote,
  ProductWorkspaceView,
  PrototypeProject,
  ScreenId,
  WorkspaceSection,
} from "./types";
import { CollaborationView } from "./views/CollaborationView";
import { DesignSystemView } from "./views/DesignSystemView";
import { DocumentsView } from "./views/DocumentsView";
import { HiFiView } from "./views/HiFiView";
import { WireframesView } from "./views/WireframesView";

const standaloneBridge: ProtoRaftBridge = {
  status: "standalone",
  callTool: async () => null,
  askAgent: async () => false,
};

const bootstrap = window.__PROTORAFT_BOOTSTRAP__;

type HostAction =
  | "schedule-task"
  | "publish-site"
  | "generate-wireframe"
  | "sync-native-core"
  | "review-conflict";

function DirectMorrowPreview() {
  const [screen, setScreen] = useState<ScreenId>("today");
  return (
    <main className="direct-preview">
      <MorrowPreview
        activeScreen={screen}
        bare
        onScreenChange={setScreen}
      />
    </main>
  );
}

export default function App() {
  const directPreview =
    new URLSearchParams(window.location.search).get("preview") === "morrow";
  const initialDisplayMode: DisplayMode =
    bootstrap?.displayMode ??
    (window.parent === window &&
    new URLSearchParams(window.location.search).get("mode") === "prod"
      ? "prod"
      : "local");
  const modeLocked = bootstrap?.locked === true;
  const [project, setProject] = useState<PrototypeProject>(
    bootstrap?.project ?? morrowProject,
  );
  const [displayMode, setDisplayMode] =
    useState<DisplayMode>(initialDisplayMode);
  const [section, setSection] = useState<WorkspaceSection>("product");
  const [productView, setProductView] =
    useState<ProductWorkspaceView>("wireframes");
  const [designView, setDesignView] =
    useState<DesignWorkspaceView>("system");
  const [activePreview, setActivePreview] = useState<ScreenId>("today");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bridgeStatus, setBridgeStatus] =
    useState<BridgeStatus>(bootstrap ? "standalone" : "connecting");
  const bridgeRef = useRef<ProtoRaftBridge>(standaloneBridge);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (directPreview || bootstrap) {
      return;
    }

    let active = true;
    connectProtoRaftApp((payload) => {
      if (active && payload.project) {
        setProject(payload.project);
      }
    }).then((bridge) => {
      if (!active) {
        return;
      }
      bridgeRef.current = bridge;
      setBridgeStatus(bridge.status);
    });

    return () => {
      active = false;
    };
  }, [directPreview]);

  useEffect(() => {
    if (displayMode === "prod" && section === "collaboration") {
      setSection("product");
    }
  }, [displayMode, section]);

  useEffect(() => {
    if (displayMode === "prod") {
      document.title = project.name;
      return;
    }
    document.title = "ProtoRaft";
  }, [displayMode, project.name]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (settingsOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, [displayMode, settingsOpen]);

  useEffect(() => {
    if (bridgeStatus !== "connected") {
      return;
    }
    const unresolved = project.screens.filter((screen) =>
      screen.image.startsWith("protoraft-asset:"),
    );
    if (unresolved.length === 0) {
      return;
    }

    let active = true;
    Promise.all(
      unresolved.map(async (screen) => {
        const path = screen.image.slice("protoraft-asset:".length);
        const payload = await bridgeRef.current.callTool(
          "get_protoraft_asset",
          {
            projectId: project.projectId,
            path,
          },
        );
        const asset = payload?.asset as
          | { data?: unknown; mimeType?: unknown }
          | undefined;
        if (
          typeof asset?.data !== "string" ||
          typeof asset.mimeType !== "string"
        ) {
          return null;
        }
        return {
          id: screen.id,
          image: `data:${asset.mimeType};base64,${asset.data}`,
        };
      }),
    ).then((assets) => {
      if (!active) {
        return;
      }
      const resolved = new Map(
        assets
          .filter((asset) => asset !== null)
          .map((asset) => [asset.id, asset.image]),
      );
      setProject((current) => ({
        ...current,
        screens: current.screens.map((screen) => ({
          ...screen,
          image: resolved.get(screen.id) ?? screen.image,
        })),
      }));
    });

    return () => {
      active = false;
    };
  }, [bridgeStatus, project.projectId, project.screens]);

  useEffect(() => {
    if (
      directPreview ||
      displayMode === "prod" ||
      bridgeStatus !== "connected"
    ) {
      return;
    }

    let active = true;
    const refreshReviewStatus = async () => {
      try {
        const payload = await bridgeRef.current.callTool(
          "get_protoraft_review_status",
          { projectId: project.projectId },
        );
        const reviewStatus = payload?.reviewStatus;
        if (active && reviewStatus && typeof reviewStatus === "object") {
          setProject((current) => ({
            ...current,
            reviewStatus:
              reviewStatus as PrototypeProject["reviewStatus"],
          }));
        }
      } catch {
        // The workbench keeps the last known state if a background refresh fails.
      }
    };

    void refreshReviewStatus();
    const interval = window.setInterval(refreshReviewStatus, 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshReviewStatus();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [bridgeStatus, directPreview, displayMode, project.projectId]);

  if (directPreview) {
    return <DirectMorrowPreview />;
  }

  const recordHostEvent = async (
    action: HostAction,
    status: "started" | "accepted" | "rejected",
  ) => {
    if (bridgeRef.current.status !== "connected") {
      return;
    }
    try {
      await bridgeRef.current.callTool("record_protoraft_host_event", {
        projectId: project.projectId,
        action,
        status,
      });
    } catch {
      // Diagnostics must never block the workflow they observe.
    }
  };

  const generateScreen = async (request: GenerateScreenRequest) => {
    if (displayMode === "prod") {
      return;
    }
    if (bridgeRef.current.status === "connected") {
      try {
        await bridgeRef.current.callTool("create_wireframe_request", {
          projectId: project.projectId,
          title: request.title,
          purpose: request.purpose,
          screenType: request.screenType,
        });
        await recordHostEvent("generate-wireframe", "started");
        const sent = await bridgeRef.current.askAgent(
          `Generate the queued ProtoRaft wireframe "${request.title}". Read the generate-wireframe skill, claim the request, create exactly one atomic screen image, and complete the request.`,
        );
        await recordHostEvent(
          "generate-wireframe",
          sent ? "accepted" : "rejected",
        );
        setToast(
          sent
            ? "Generation request sent to Codex."
            : "Codex could not receive the generation request.",
        );
      } catch {
        await recordHostEvent("generate-wireframe", "rejected");
        setToast("The generation request could not be prepared.");
      }
      return;
    }

    setToast("Generation request staged in local preview.");
  };

  const addDiscussion = async (screenId: ScreenId, body: string) => {
    if (displayMode === "prod") {
      return;
    }
    let note: DiscussionNote = {
      id: `local_${Date.now()}`,
      screenId,
      author: "You",
      body,
      createdAt: new Date().toISOString(),
    };
    let revision = project.discussionRevision;

    if (bridgeRef.current.status === "connected") {
      const payload = await bridgeRef.current.callTool(
        "add_protoraft_discussion_note",
        {
          projectId: project.projectId,
          screenId,
          body,
          author: "You",
          expectedRevision: project.discussionRevision,
        },
      );
      const saved = payload?.saved as
        | { note?: DiscussionNote; revision?: string }
        | undefined;
      if (saved?.note) {
        note = saved.note;
        revision = saved.revision;
      }
    }

    setProject((current) => ({
      ...current,
      discussions: [...current.discussions, note],
      discussionRevision: revision,
    }));
    setToast("Discussion note added.");
  };

  const saveDocument = async (id: string, content: string) => {
    if (displayMode === "prod") {
      return;
    }
    const document = project.documents.find((item) => item.id === id);
    if (!document) {
      return;
    }

    setProject((current) => ({
      ...current,
      documents: current.documents.map((item) =>
        item.id === id ? { ...item, content, updatedAt: "Just now" } : item,
      ),
    }));

    if (bridgeRef.current.status === "connected") {
      await bridgeRef.current.callTool("save_protoraft_document", {
        projectId: project.projectId,
        path: document.filename,
        content,
      });
    }
    setToast("Document saved.");
  };

  const resolveChange = async (change: BranchChange) => {
    if (displayMode === "prod") {
      return;
    }
    const base = project.branches[0];
    const compare = project.branches[1];
    const recommendation = change.recommendation
      ? ` The workbench recommendation is: ${change.recommendation}`
      : "";
    await recordHostEvent("review-conflict", "started");
    try {
      const sent = await bridgeRef.current.askAgent(
        `Review the ProtoRaft conflict in ${change.path} between ${base?.gitRef ?? base?.name ?? "the base branch"} and ${compare?.gitRef ?? compare?.name ?? "the comparison branch"}. ${change.summary}${recommendation} Read AGENTS.md and the repository's collaboration scenario, inspect both branch versions and related artifacts, explain the product impact in plain language, then propose the smallest coherent resolution. Do not write, merge, commit, or push until the user confirms.`,
      );
      await recordHostEvent(
        "review-conflict",
        sent ? "accepted" : "rejected",
      );
      setToast(
        sent
          ? "Conflict context sent to Codex."
          : "Resolution prompt prepared in local preview.",
      );
    } catch {
      await recordHostEvent("review-conflict", "rejected");
      setToast("Codex could not receive the conflict context.");
    }
  };

  const syncCore = async (platform: "ios" | "android" | "all") => {
    if (displayMode === "prod") {
      return;
    }
    const target =
      platform === "all"
        ? "the user's Android and iOS target repositories"
        : `the user's ${platform === "ios" ? "iOS" : "Android"} target repository`;
    await recordHostEvent("sync-native-core", "started");
    try {
      const sent = await bridgeRef.current.askAgent(
        `Read the ProtoRaft sync-native-core skill and sync the approved shared core into ${target}. Confirm the target repository before writing, then use the bundled conversion, task-planning, visual-verification, and implementation-loop skills.`,
      );
      await recordHostEvent(
        "sync-native-core",
        sent ? "accepted" : "rejected",
      );
      setToast(
        sent
          ? "Core sync request sent to Codex."
          : "Core sync request prepared in local preview.",
      );
    } catch {
      await recordHostEvent("sync-native-core", "rejected");
      setToast("Codex could not receive the core sync request.");
    }
  };

  const repositoryName = project.repositoryName ?? project.name;
  const readOnly = displayMode === "prod";
  const branchChangeCount = project.branches
    .slice(1)
    .reduce((total, branch) => total + branch.changes.length, 0);
  const reviewAttention =
    project.reviewStatus?.state === "updates-available" ||
    branchChangeCount > 0;

  const requestScheduledReview = async (
    request: ScheduledReviewRequest,
  ): Promise<boolean> => {
    if (readOnly) {
      return false;
    }
    const cadence =
      request.cadence === "daily"
        ? "every day"
        : request.cadence === "weekdays"
          ? "every weekday"
          : "every Monday";
    const environment =
      request.environment === "worktree"
        ? "an isolated worktree"
        : "the local checkout";
    try {
      await recordHostEvent("schedule-task", "started");
      const sent = await bridgeRef.current.askAgent(
        `Create or update a Codex scheduled task named "ProtoRaft · ${repositoryName} canvas freshness". Run it ${cadence} at ${request.time} (${request.timezone}) against the currently open ProtoRaft repository, using ${environment}. Use ProtoRaft's check-canvas-freshness skill. The task must inspect the manifest-declared screens, wireframes, flow, linked documents, design tokens, component contracts, working-tree changes, and upstream changes. Write the machine-readable result atomically to <git-common-dir>/protoraft/review-status.json with schemaVersion "0.1", state "current", "updates-available", or "error", checkedAt as ISO 8601, a short summary, and changedArtifacts as a number. Never merge, commit, push, or modify the repository working tree. After creating the task, confirm its exact schedule and execution environment to the user.`,
      );
      await recordHostEvent(
        "schedule-task",
        sent ? "accepted" : "rejected",
      );
      if (sent) {
        setSettingsOpen(false);
        setToast("Scheduled task request sent to Codex.");
      } else {
        setToast("Scheduling is only available inside Codex.");
      }
      return sent;
    } catch {
      await recordHostEvent("schedule-task", "rejected");
      setToast("Codex could not receive the scheduled task request.");
      return false;
    }
  };

  const changeDisplayMode = async (mode: DisplayMode) => {
    if (modeLocked || mode === displayMode) {
      return;
    }

    try {
      if (bridgeRef.current.status === "connected") {
        const tool =
          mode === "prod"
            ? "get_protoraft_production_project"
            : "get_protoraft_project";
        const payload = await bridgeRef.current.callTool(tool, {
          projectId: project.projectId,
        });
        if (!payload?.project || typeof payload.project !== "object") {
          throw new Error("Project snapshot was unavailable.");
        }
        setProject(payload.project as PrototypeProject);
      }

      setDisplayMode(mode);
      if (mode === "prod") {
        setSection("product");
      }
      const url = new URL(window.location.href);
      if (mode === "prod") {
        url.searchParams.set("mode", "prod");
      } else {
        url.searchParams.delete("mode");
      }
      window.history.replaceState({}, "", url);
      setToast(
        mode === "prod"
          ? `Production preview loaded from ${project.defaultBranch}.`
          : "Local read & write mode restored.",
      );
    } catch {
      setToast("Display mode could not be changed.");
    }
  };

  const publishCurrentProject = async () => {
    if (bridgeRef.current.status !== "connected") {
      setToast("Publishing is available from the installed Codex plugin.");
      return;
    }

    let handoffStarted = false;
    try {
      const payload = await bridgeRef.current.callTool(
        "prepare_protoraft_site",
        { projectId: project.projectId },
      );
      const site = payload?.site as
        | {
            sourceDirectory?: unknown;
            branch?: unknown;
            projectName?: unknown;
          }
        | undefined;
      if (
        typeof site?.sourceDirectory !== "string" ||
        typeof site.branch !== "string"
      ) {
        throw new Error("Site export was unavailable.");
      }

      await recordHostEvent("publish-site", "started");
      handoffStarted = true;
      const sent = await bridgeRef.current.askAgent(
        `Publish the prepared ProtoRaft production site at ${JSON.stringify(site.sourceDirectory)} using Codex Sites. It is a self-contained, read-only export of ${JSON.stringify(String(site.projectName ?? project.name))} from ${JSON.stringify(site.branch)}. Read the ProtoRaft publish-site skill, preserve the prepared Production UI, run its build, create or reuse a Sites project, and deploy with an access level suitable for sharing the review site with other people while following any required approval flow. Return the deployed URL. Do not publish the local editable workbench or another branch.`,
      );
      await recordHostEvent(
        "publish-site",
        sent ? "accepted" : "rejected",
      );
      if (sent) {
        setSettingsOpen(false);
      }
      setToast(
        sent
          ? "Site publish request sent to Codex."
          : "Site publish request could not be sent.",
      );
    } catch {
      if (handoffStarted) {
        await recordHostEvent("publish-site", "rejected");
      }
      setToast("The production site could not be prepared.");
    }
  };

  return (
    <div className={`app-shell app-shell--${displayMode}`}>
      <Sidebar
        activeSection={section}
        displayMode={displayMode}
        reviewAttention={reviewAttention}
        showSettings={!modeLocked}
        onSectionChange={setSection}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="app-main">
        {readOnly && (
          <header className="production-topbar">
            <div className="production-project-name">
              <strong>{project.name}</strong>
              <small>v{project.version}</small>
            </div>
            <div className="production-topbar-actions">
              <span>
                <Globe2 size={14} />
                Read only
              </span>
              {!modeLocked && (
                <button
                  type="button"
                  className="icon-button production-settings-button"
                  aria-label="Settings"
                  title="Settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings size={17} />
                </button>
              )}
            </div>
          </header>
        )}
        <main className="workspace-main">
          {section === "product" && productView === "wireframes" && (
            <WireframesView
              screens={project.screens}
              connections={project.connections}
              discussions={project.discussions}
              readOnly={readOnly}
              activeWorkspaceView={productView}
              onWorkspaceViewChange={setProductView}
              onGenerate={() => setGenerateOpen(true)}
              onAddDiscussion={addDiscussion}
            />
          )}
          {section === "product" && productView === "documents" && (
            <DocumentsView
              documents={project.documents}
              screens={project.screens}
              readOnly={readOnly}
              activeWorkspaceView={productView}
              onWorkspaceViewChange={setProductView}
              onSave={saveDocument}
            />
          )}
          {section === "design" && designView === "system" && (
            <DesignSystemView
              tokens={project.tokens}
              components={project.components}
              readOnly={readOnly}
              activeWorkspaceView={designView}
              onWorkspaceViewChange={setDesignView}
              onSyncCore={syncCore}
            />
          )}
          {section === "design" && designView === "preview" && (
            <HiFiView
              screens={project.screens}
              connections={project.connections}
              activeScreen={activePreview}
              activeWorkspaceView={designView}
              onWorkspaceViewChange={setDesignView}
              onScreenChange={setActivePreview}
            />
          )}
          {!readOnly && section === "collaboration" && (
            <CollaborationView
              branches={project.branches}
              onResolve={resolveChange}
              onNotify={setToast}
            />
          )}
        </main>

        {!readOnly && (
          <footer className="workspace-statusbar">
            <div className="statusbar-leading">
              <strong className="status-project-name" title={repositoryName}>
                {repositoryName}
              </strong>
              <button
                type="button"
                className="status-settings"
                aria-label="Settings"
                title="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={15} />
              </button>
            </div>
            <div className="statusbar-trailing">
              <button type="button" className="status-branch">
                <GitBranch size={15} />
                <strong>{project.defaultBranch}</strong>
                <ChevronDown size={13} />
              </button>
              <span className="status-connection">
                <CheckCircle2 size={15} />
                {bridgeStatus === "connected"
                  ? "Connected"
                  : bridgeStatus === "connecting"
                    ? "Connecting"
                    : "Preview data"}
              </span>
            </div>
          </footer>
        )}
      </div>

      {!readOnly && (
        <GenerateScreenDialog
          open={generateOpen}
          onClose={() => setGenerateOpen(false)}
          onSubmit={generateScreen}
        />
      )}

      {!modeLocked && (
        <SettingsDialog
          open={settingsOpen}
          repositoryName={repositoryName}
          defaultBranch={project.defaultBranch}
          displayMode={displayMode}
          reviewStatus={project.reviewStatus}
          branchChangeCount={branchChangeCount}
          schedulingAvailable={bridgeStatus === "connected"}
          onClose={() => setSettingsOpen(false)}
          onDisplayModeChange={changeDisplayMode}
          onPublish={publishCurrentProject}
          onRequestSchedule={requestScheduledReview}
        />
      )}

      <div
        className={`toast ${toast ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 size={16} />
        {toast}
      </div>
    </div>
  );
}
