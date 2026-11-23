import {
  CheckCircle2,
  ChevronDown,
  Globe2,
  GitBranch,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  BranchSnapshot,
  PublicationSource,
  DesignWorkspaceView,
  DisplayMode,
  DiscussionNote,
  DocumentWriteResult,
  DocumentDraft,
  ProductDocument,
  WireframeRequestSummary,
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
  const [section, setSection] = useState<WorkspaceSection>(
    bootstrap?.project.publication?.kind === "branch-review" ? "collaboration" : "product",
  );
  const [productView, setProductView] =
    useState<ProductWorkspaceView>("wireframes");
  const [designView, setDesignView] =
    useState<DesignWorkspaceView>("system");
  const [activePreview, setActivePreview] = useState<ScreenId>("today");
  const [generationSource, setGenerationSource] = useState<ScreenId | null>(null);
  const [documentDrafts, setDocumentDrafts] = useState<Record<string, DocumentDraft>>({});
  const [requests, setRequests] = useState<WireframeRequestSummary[]>([]);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [requestWarning, setRequestWarning] = useState("");
  const [focusScreen, setFocusScreen] = useState<{ id: ScreenId } | null>(null);
  const clearFocusedScreen = useCallback(() => setFocusScreen(null), []);
  const [projectReady, setProjectReady] = useState(Boolean(bootstrap) || window.parent === window);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publicationSources, setPublicationSources] = useState<PublicationSource[]>([]);
  const [publicationError, setPublicationError] = useState("");
  const [loadedDocumentAssets, setLoadedDocumentAssets] = useState<Record<string, string>>({});
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
        setProjectReady(true);
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
    if (displayMode === "prod" && section === "collaboration" && project.publication?.kind !== "branch-review") {
      setSection("product");
    }
  }, [displayMode, section, project.publication?.kind]);

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
    if (bridgeStatus !== "connected" || !projectReady) {
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
      }).map((request) => request.catch(() => null)),
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
  }, [bridgeStatus, projectReady, project.projectId, project.screens]);

  useEffect(() => {
    if (
      directPreview ||
      displayMode === "prod" ||
      bridgeStatus !== "connected" || !projectReady
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
  }, [bridgeStatus, directPreview, displayMode, projectReady, project.projectId]);

  useEffect(() => {
    if (!projectReady || bridgeStatus !== "connected" || displayMode !== "local") return;

    let active = true;
    let refreshing = false;
    let timer: number | undefined;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const payload = await bridgeRef.current.callTool("list_wireframe_requests", { projectId: project.projectId });
        if (active && Array.isArray(payload?.requests)) {
          setRequests(payload.requests as WireframeRequestSummary[]);
          setRequestWarning("");
        }
      } catch {
        if (active) setRequestWarning("Generation status is unavailable. Retrying…");
      } finally {
        refreshing = false;
        if (active) timer = window.setTimeout(refresh, 2500);
      }
    };
    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [bridgeStatus, displayMode, projectReady, project.projectId]);

  useEffect(() => {
    if (!projectReady || bridgeStatus !== "connected" || displayMode !== "local") return;
    const missing = requests.some((request) => request.status === "completed" && request.availableOnCanvas !== false &&
      request.screenId && !project.screens.some((screen) => screen.id === request.screenId));
    if (!missing) return;

    let active = true;
    void bridgeRef.current.callTool("get_protoraft_project", { projectId: project.projectId })
      .then((payload) => {
        const refreshed = payload?.project as PrototypeProject | undefined;
        if (active && refreshed) {
          setProject((current) => ({
            ...current,
            screens: refreshed.screens,
            connections: refreshed.connections,
          }));
        }
      })
      .catch(() => {
        if (active) setRequestWarning("The canvas could not refresh. Open the result to try again.");
      });
    return () => { active = false; };
  }, [bridgeStatus, displayMode, projectReady, project.projectId, project.screens, requests]);

  const listPublicationSources = useCallback(async () => {
    try {
      const payload = await bridgeRef.current.callTool("list_protoraft_publication_sources", { projectId: project.projectId });
      if (!Array.isArray(payload?.sources)) throw new Error("Could not load Git revisions.");
      setPublicationSources(payload.sources as PublicationSource[]);
      setPublicationError("");
    } catch (error) {
      setPublicationSources([]);
      setPublicationError(error instanceof Error ? error.message : "Could not load Git revisions.");
    }
  }, [project.projectId]);

  useEffect(() => {
    if (!settingsOpen || !projectReady || bridgeStatus !== "connected") return;
    void listPublicationSources();
  }, [settingsOpen, projectReady, bridgeStatus, listPublicationSources]);

  useEffect(() => {
    if (!projectReady || bridgeStatus !== "connected" || displayMode === "prod") return;
    const screenPaths = new Set(project.screens.map((screen) => screen.assetPath));
    const paths = project.documentAssetPaths?.filter((path) => !screenPaths.has(path)) ?? [];
    let active = true;
    void Promise.all(paths.map(async (path) => {
      try {
        const payload = await bridgeRef.current.callTool("get_protoraft_asset", { projectId: project.projectId, path });
        const asset = payload?.asset as { data?: string; mimeType?: string } | undefined;
        return asset?.data && asset.mimeType ? [path, `data:${asset.mimeType};base64,${asset.data}`] : null;
      } catch {
        return null;
      }
    })).then((assets) => {
      if (active) setLoadedDocumentAssets(Object.fromEntries(assets.filter((entry) => entry !== null)));
    });
    return () => { active = false; };
  }, [bridgeStatus, displayMode, project.documentAssetPaths, project.projectId, project.screens, projectReady]);

  const documentAssets = useMemo(() => {
    const assets = { ...(displayMode === "local" ? loadedDocumentAssets : project.documentAssets) };
    for (const screen of project.screens) {
      if (screen.assetPath && screen.image.startsWith("data:")) assets[screen.assetPath] = screen.image;
    }
    return assets;
  }, [displayMode, loadedDocumentAssets, project.documentAssets, project.screens]);

  const baseCommit = project.branches[0]?.fullCommit;
  const compareCommit = project.branches[1]?.fullCommit;
  const loadBranchImages = useCallback(async (change: BranchChange) => {
    const payload = await bridgeRef.current.callTool("get_protoraft_branch_images", {
      projectId: project.projectId,
      base: baseCommit,
      compare: compareCommit,
      path: change.path,
      previousPath: change.previousPath,
    });
    return {
      baseImage: typeof payload?.baseImage === "string" ? payload.baseImage : undefined,
      compareImage: typeof payload?.compareImage === "string" ? payload.compareImage : undefined,
    };
  }, [project.projectId, baseCommit, compareCommit]);

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

  const recordRequest = (request: WireframeRequestSummary) => {
    setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
  };

  const sendGenerationRequest = async (request: WireframeRequestSummary) => {
    await recordHostEvent("generate-wireframe", "started");
    try {
      const sent = await bridgeRef.current.askAgent(
        `Generate the ProtoRaft wireframe for projectId ${project.projectId} and requestId ${request.id}. Read the generate-wireframe skill and claim this exact request. Use the purpose and format from the claimed request, then complete it or report failure using its claim token.`,
      );
      if (!sent) throw new Error("Codex did not accept the message.");
      await recordHostEvent("generate-wireframe", "accepted");
    } catch (error) {
      await recordHostEvent("generate-wireframe", "rejected");
      throw new Error("The request is queued. Select Send to Codex to send it again.", { cause: error });
    }
  };

  const generateScreen = async (input: GenerateScreenRequest) => {
    setToast("");
    const payload = await bridgeRef.current.callTool("create_wireframe_request", {
      projectId: project.projectId,
      ...input,
      sourceScreenId: generationSource ?? undefined,
    });
    const request = payload?.request as WireframeRequestSummary | undefined;
    if (!request) throw new Error("The server did not confirm the queued request.");
    recordRequest(request);
    if (request.status !== "queued") return;
    try {
      await sendGenerationRequest(request);
      setToast("Generation request sent to Codex.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The request is queued.");
    }
  };

  const retryGeneration = async (request: WireframeRequestSummary) => {
    setDispatching(request.id);
    try {
      if (request.status === "failed") {
        const payload = await bridgeRef.current.callTool("retry_wireframe_request", {
          projectId: project.projectId,
          requestId: request.id,
        });
        const updated = payload?.request as WireframeRequestSummary | undefined;
        if (!updated) throw new Error("The server did not confirm the retry.");
        recordRequest(updated);
      }
      await sendGenerationRequest(request);
      setToast("Generation request sent to Codex.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not send the request.");
    } finally {
      setDispatching(null);
    }
  };

  const openGeneratedScreen = async (screenId: ScreenId) => {
    try {
      if (!project.screens.some((screen) => screen.id === screenId)) {
        const payload = await bridgeRef.current.callTool("get_protoraft_project", { projectId: project.projectId });
        const refreshed = payload?.project as PrototypeProject | undefined;
        if (!refreshed?.screens.some((screen) => screen.id === screenId)) {
          throw new Error("This result is missing from the current branch’s canvas.");
        }
        setProject((current) => ({ ...current, screens: refreshed.screens, connections: refreshed.connections }));
      }
      setFocusScreen({ id: screenId });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not open the result.");
    }
  };

  const addDiscussion = async (screenId: ScreenId, body: string, noteId: string) => {
    setToast("");
    if (bridgeStatus === "standalone") {
      const note: DiscussionNote = { id: noteId, screenId, body, author: "You", createdAt: new Date().toISOString() };
      setProject((current) => ({ ...current, discussions: [...current.discussions, note] }));
      setToast("Note added to this preview. It will reset on reload.");
      return;
    }

    try {
      const payload = await bridgeRef.current.callTool("add_protoraft_discussion_note", {
        projectId: project.projectId,
        screenId,
        body,
        noteId,
        author: "You",
        expectedRevision: project.discussionRevision,
      });
      const saved = payload?.saved as { note?: DiscussionNote; revision?: string } | undefined;
      if (!saved?.note || !saved.revision) throw new Error("The server did not confirm the note.");
      const note = saved.note;
      setProject((current) => ({
        ...current,
        discussions: [...current.discussions.filter((item) => item.id !== note.id), note],
        discussionRevision: saved.revision,
      }));
      setToast("Discussion note added.");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("REVISION_CONFLICT")) throw error;

      const payload = await bridgeRef.current.callTool("get_protoraft_project", { projectId: project.projectId });
      const latest = payload?.project as PrototypeProject | undefined;
      if (!latest) throw new Error("Could not reload the discussion. Your draft is still here.");
      setProject((current) => ({
        ...current,
        discussions: latest.discussions,
        discussionRevision: latest.discussionRevision,
      }));
      throw new Error("The discussion changed. Review the latest notes and add your draft again.");
    }
  };

  const saveDocument = async (id: string, content: string, expectedRevision?: string): Promise<DocumentWriteResult> => {
    setToast("");
    const document = project.documents.find((item) => item.id === id);
    if (!document) throw new Error("This document is no longer available.");
    let savedRevision = document.revision;
    let assetPaths: string[] = [];
    if (bridgeStatus === "connected") {
      if (!expectedRevision) throw new Error("Reload this document before saving.");
      try {
        const payload = await bridgeRef.current.callTool("save_protoraft_document", {
          projectId: project.projectId,
          path: document.filename,
          content,
          expectedRevision,
        });
        const saved = payload?.saved as { revision?: string; assetPaths?: string[] } | undefined;
        if (!saved?.revision) throw new Error("The server did not confirm the save.");
        savedRevision = saved.revision;
        assetPaths = saved.assetPaths ?? [];
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("REVISION_CONFLICT")) throw error;
        const payload = await bridgeRef.current.callTool("get_protoraft_project", { projectId: project.projectId });
        const refreshed = payload?.project as { documents: ProductDocument[] } | undefined;
        const latest = refreshed?.documents.find((item) => item.id === id);
        if (!latest) throw new Error("Could not reload the document. Your draft is still here.");
        setProject((current) => ({
          ...current,
          documents: current.documents.map((item) => item.id === id ? latest : item),
        }));
        return { status: "conflict", latest };
      }
    }

    setProject((current) => ({
      ...current,
      documentAssetPaths: assetPaths.length
        ? [...new Set([...(current.documentAssetPaths ?? []), ...assetPaths])]
        : current.documentAssetPaths,
      documents: current.documents.map((item) =>
        item.id === id ? { ...item, content, revision: savedRevision, updatedAt: "Just now" } : item,
      ),
    }));
    setToast(bridgeStatus === "standalone" ? "Saved to this preview until reload." : "Document saved.");
    return { status: "saved" };
  };

  const scanBranches = async () => {
    const [base, compare] = project.branches;
    if (!base || !compare) throw new Error("Two branches are required.");
    const payload = await bridgeRef.current.callTool("compare_protoraft_branches", {
      projectId: project.projectId,
      base: base.gitRef ?? base.name,
      compare: compare.gitRef ?? compare.name,
      scanConflicts: true,
      includeReview: true,
    });
    if (!Array.isArray(payload?.branches)) throw new Error("The comparison was not returned.");
    const branches = payload.branches as BranchSnapshot[];
    setProject((current) => ({ ...current, branches }));
    setToast("Branch comparison refreshed.");
  };

  const saveReviewDecision = async (change: BranchChange, decision: string) => {
    const [base, compare] = project.branches;
    if (!base || !compare?.decisionRevision) throw new Error("Rescan before recording a decision.");
    const payload = await bridgeRef.current.callTool("save_protoraft_review_decision", {
      projectId: project.projectId, base: base.name, compare: compare.name,
      path: change.path, decision, expectedRevision: compare.decisionRevision,
    });
    const saved = payload?.saved as { decision: string; revision: string } | undefined;
    if (!saved?.revision) throw new Error("The server did not confirm the decision.");
    setProject((current) => ({
      ...current,
      branches: current.branches.map((branch) => branch.name === compare.name ? {
        ...branch,
        decisionRevision: saved.revision,
        changes: branch.changes.map((item) => item.path === change.path ? { ...item, decision: saved.decision } : item),
      } : branch),
    }));
    setToast("Product decision saved to the repository.");
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
        `Review the ProtoRaft change in ${change.path} between ${base?.gitRef ?? base?.name ?? "the base branch"} and ${compare?.gitRef ?? compare?.name ?? "the comparison branch"}. ${change.summary}${recommendation} Read AGENTS.md and the repository's collaboration scenario, inspect both branch versions and related artifacts, explain the product impact in plain language, then propose the smallest coherent resolution. Do not write, merge, commit, or push until the user confirms.`,
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
  const sharedReview = project.publication?.kind === "branch-review";
  const liveReview = !readOnly && bridgeStatus === "connected";
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

  const publishCurrentProject = async (source: PublicationSource) => {
    let handoffStarted = false;
    try {
      const payload = await bridgeRef.current.callTool("prepare_protoraft_site", { projectId: project.projectId, source });
      const site = payload?.site as { sourceDirectory?: string; branch?: string; commit?: string; projectName?: string } | undefined;
      if (!site?.sourceDirectory || site.branch !== source.branch || site.commit !== source.commit) {
        throw new Error("The export does not match the selected Git revision.");
      }

      await recordHostEvent("publish-site", "started");
      handoffStarted = true;
      const sent = await bridgeRef.current.askAgent(
        `Use the ProtoRaft publish-site skill to publish the prepared read-only ${source.kind} at ${JSON.stringify(site.sourceDirectory)}. Expected branch: ${JSON.stringify(source.branch)}. Expected Git commit: ${source.commit}. Verify the prepared snapshot metadata matches before deploying. Follow the access and approval flow and return the deployed URL.`,
      );
      await recordHostEvent("publish-site", sent ? "accepted" : "rejected");
      if (!sent) throw new Error("Codex did not receive the publish request. You can try again.");
      setSettingsOpen(false);
      setToast("Site publish request sent to Codex.");
    } catch (error) {
      if (handoffStarted) await recordHostEvent("publish-site", "rejected");
      void listPublicationSources();
      throw error;
    }
  };

  if (!projectReady || bridgeStatus === "error" || bridgeStatus === "connecting") {
    return (
      <main className="workspace-view" role="status">
        <h1>ProtoRaft</h1>
        <p>{bridgeStatus === "error" ? "Could not connect to Codex. Open the project again from the chat." : "Opening the repository…"}</p>
      </main>
    );
  }

  return (
    <div className={`app-shell app-shell--${displayMode}`}>
      <Sidebar
        activeSection={section}
        displayMode={displayMode}
        showSharedReview={sharedReview}
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
              {project.publication && <code title={project.publication.commit}>{project.publication.branch} · {project.publication.commit.slice(0, 7)}</code>}
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
              canGenerate={bridgeStatus === "connected"}
              requests={requests}
              requestWarning={requestWarning}
              dispatching={dispatching}
              focusScreen={focusScreen}
              onResultFocused={clearFocusedScreen}
              onGenerate={setGenerationSource}
              onRetryGeneration={retryGeneration}
              onOpenResult={openGeneratedScreen}
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
              temporary={bridgeStatus === "standalone"}
              assets={documentAssets}
              drafts={documentDrafts}
              setDrafts={setDocumentDrafts}
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
              onRequestChange={liveReview ? async (screen, request) => {
                const sent = await bridgeRef.current.askAgent([
                  "ProtoRaft HiFi change request",
                  `Project: ${project.name} (projectId: ${project.projectId})`,
                  `Screen: ${screen.title} (${screen.route}, id: ${screen.id})`,
                  `Module: ${request.moduleLabel} (data-review-target="${request.moduleId}")`,
                  `Change: ${request.comment}`,
                ].join("\n"));
                if (sent) setToast("Change request sent to Codex.");
                return sent;
              } : undefined}
            />
          )}
          {(!readOnly || sharedReview) && section === "collaboration" && (
            <CollaborationView
              branches={project.branches}
              readOnly={!liveReview}
              onScan={liveReview ? scanBranches : undefined}
              onImages={liveReview && baseCommit && compareCommit ? loadBranchImages : undefined}
              onResolve={liveReview ? resolveChange : undefined}
              onSaveDecision={liveReview ? saveReviewDecision : undefined}
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
                  : "Preview data"}
              </span>
            </div>
          </footer>
        )}
      </div>

      {!readOnly && (
        <GenerateScreenDialog
          open={generationSource !== null}
          onClose={() => setGenerationSource(null)}
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
          publicationAvailable={bridgeStatus === "connected"}
          publicationSources={publicationSources}
          publicationError={publicationError}
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
