import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  access,
  mkdtemp,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROJECT_MANIFEST = "protoraft.project.json";
const REQUEST_DIRECTORY = ".protoraft/requests";
const REVIEW_STATUS_DIRECTORY = "protoraft";
const REVIEW_STATUS_FILE = "review-status.json";
const TEXT_PREVIEW_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);
const MAX_GIT_PREVIEW_BYTES = 64 * 1024;

interface ProjectManifest {
  schemaVersion: string;
  projectId: string;
  name: string;
  version: string;
  summary: string;
  flow: string;
  discussions?: string;
  documents: Array<{
    id: string;
    title: string;
    path: string;
    screenIds: string[];
  }>;
  designSystem: {
    tokens: string;
    components: string;
  };
  collaboration?: {
    sourceOfTruth?: string;
    defaultBranch?: string;
    mode?: string;
    reviewScenarios?: string;
  };
}

interface FlowFile {
  nodes: Array<{
    id: string;
    screen: string;
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
  }>;
}

interface ScreenFile {
  id: string;
  title: string;
  route: string;
  stage?: "wireframe" | "review" | "approved";
  purpose: string;
  wireframe: string;
  entry?: string[];
  actions?: Array<{ label: string; target: string }>;
  states?: string[];
  linkedDocuments?: string[];
}

interface DiscussionFile {
  notes?: Array<{
    id: string;
    screenId: string;
    author: string;
    body: string;
    createdAt: string;
  }>;
}

interface ComponentsFile {
  components?: Array<{
    id: string;
    name: string;
    category?: string;
    variants?: string[];
    states?: string[];
    platforms?: string[];
    description?: string;
  }>;
}

interface ReviewScenariosFile {
  schemaVersion?: string;
  comparisons?: Array<{
    base: string;
    compare: string;
    changes?: Array<{
      path: string;
      summary?: string;
      recommendation?: string;
    }>;
  }>;
}

interface GitBranchCandidate {
  name: string;
  ref: string;
}

interface ReviewStatusFile {
  schemaVersion?: string;
  state?: "current" | "updates-available" | "error";
  checkedAt?: string;
  summary?: string;
  changedArtifacts?: number;
}

export interface ProjectSession {
  id: string;
  root: string;
  manifest: ProjectManifest;
}

export interface SaveDocumentResult {
  path: string;
  previousRevision: string;
  revision: string;
}

export interface AddDiscussionNoteResult {
  note: {
    id: string;
    screenId: string;
    author: string;
    body: string;
    createdAt: string;
  };
  revision: string;
}

export interface WireframeRequest {
  id: string;
  projectId: string;
  title: string;
  purpose: string;
  screenType: string;
  status: "queued" | "claimed" | "completed";
  createdAt: string;
  updatedAt: string;
  claimedBy?: string;
  claimToken?: string;
  screenId?: string;
  screenDefinitionPath?: string;
  wireframePath?: string;
}

export interface BranchComparison {
  base: string;
  compare: string;
  mergeBase: string;
  changedFiles: Array<{
    path: string;
    kind: "added" | "modified" | "deleted" | "renamed";
  }>;
  possibleConflicts: string[];
}

function hashContent(content: string | Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

function opaqueProjectId(root: string) {
  return `prj_${createHash("sha256").update(root).digest("hex").slice(0, 16)}`;
}

function isInside(root: string, candidate: string) {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function assertRelativePath(value: string) {
  if (
    !value ||
    value.includes("\0") ||
    isAbsolute(value) ||
    value.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`Unsafe project path: ${value}`);
  }
}

function normalizeProjectPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

async function readJson<T>(path: string): Promise<T> {
  const source = await readFile(path, "utf8");
  return JSON.parse(source) as T;
}

async function atomicWrite(path: string, content: string) {
  const tempPath = join(
    dirname(path),
    `.${path.split("/").at(-1)}.${process.pid}.${randomBytes(5).toString("hex")}.tmp`,
  );
  try {
    await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, path);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

function formatTokenValue(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    "unit" in value
  ) {
    const dimension = value as { value: number | string; unit: string };
    return `${dimension.value}${dimension.unit}`;
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function flattenTokens(
  value: unknown,
  path: string[] = [],
): Array<{
  path: string;
  group: "Color" | "Typography" | "Space" | "Radius";
  value: string;
  description: string;
  swatch?: string;
}> {
  if (!value || typeof value !== "object") {
    return [];
  }

  const token = value as Record<string, unknown>;
  if ("$value" in token) {
    const root = path[0]?.toLowerCase();
    const group =
      root === "color"
        ? "Color"
        : root === "font"
          ? "Typography"
          : root === "radius"
            ? "Radius"
            : "Space";
    const formatted = formatTokenValue(token.$value);
    return [
      {
        path: path.join("."),
        group,
        value: formatted,
        description:
          typeof token.$description === "string" ? token.$description : "",
        swatch:
          group === "Color" && /^#[0-9a-f]{6}$/i.test(formatted)
            ? formatted
            : undefined,
      },
    ];
  }

  return Object.entries(token)
    .filter(([key]) => !key.startsWith("$"))
    .flatMap(([key, child]) => flattenTokens(child, [...path, key]));
}

function toPlatform(value: string): "Web" | "iOS" | "Android" | null {
  const normalized = value.toLowerCase();
  if (normalized === "web") {
    return "Web";
  }
  if (normalized === "ios") {
    return "iOS";
  }
  if (normalized === "android") {
    return "Android";
  }
  return null;
}

function mimeTypeFor(path: string) {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  throw new Error(`Unsupported image type: ${extension || "none"}`);
}

function assertGitRef(ref: string) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref) ||
    ref.includes("..") ||
    ref.includes("@{") ||
    ref.endsWith("/") ||
    ref.endsWith(".lock")
  ) {
    throw new Error(`Unsafe Git ref: ${ref}`);
  }
}

export class ProjectStore {
  private readonly sessions = new Map<string, ProjectSession>();

  async open(rootPath: string): Promise<ProjectSession> {
    const root = await realpath(resolve(rootPath));
    const rootStat = await stat(root);
    if (!rootStat.isDirectory()) {
      throw new Error("ProtoRaft project root must be a directory.");
    }

    const manifestPath = join(root, PROJECT_MANIFEST);
    await access(manifestPath);
    const manifest = await readJson<ProjectManifest>(manifestPath);
    if (manifest.schemaVersion !== "0.1") {
      throw new Error(
        `Unsupported ProtoRaft schema version: ${manifest.schemaVersion}`,
      );
    }

    const id = opaqueProjectId(root);
    const session = { id, root, manifest };
    this.sessions.set(id, session);
    return session;
  }

  get(projectId: string): ProjectSession {
    const session = this.sessions.get(projectId);
    if (!session) {
      throw new Error(
        "Unknown ProtoRaft project. Open the workbench again for this repository.",
      );
    }
    return session;
  }

  private async resolveExisting(session: ProjectSession, projectPath: string) {
    assertRelativePath(projectPath);
    const candidate = resolve(session.root, projectPath);
    if (!isInside(session.root, candidate)) {
      throw new Error(`Path escapes the project root: ${projectPath}`);
    }
    const actual = await realpath(candidate);
    if (!isInside(session.root, actual)) {
      throw new Error(`Symlink escapes the project root: ${projectPath}`);
    }
    return actual;
  }

  private async resolveWritable(session: ProjectSession, projectPath: string) {
    assertRelativePath(projectPath);
    const candidate = resolve(session.root, projectPath);
    if (!isInside(session.root, candidate)) {
      throw new Error(`Path escapes the project root: ${projectPath}`);
    }

    const parent = await realpath(dirname(candidate));
    if (!isInside(session.root, parent)) {
      throw new Error(`Parent path escapes the project root: ${projectPath}`);
    }

    try {
      const actual = await realpath(candidate);
      if (!isInside(session.root, actual)) {
        throw new Error(`Symlink escapes the project root: ${projectPath}`);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }

    return candidate;
  }

  async loadProject(projectId: string) {
    const session = this.get(projectId);
    const flowPath = await this.resolveExisting(session, session.manifest.flow);
    const flow = await readJson<FlowFile>(flowPath);

    const screens = await Promise.all(
      flow.nodes.map(async (node) => {
        const screenPath = await this.resolveExisting(session, node.screen);
        const screen = await readJson<ScreenFile>(screenPath);
        const assetPath = normalizeProjectPath(
          relative(
            session.root,
            resolve(dirname(screenPath), screen.wireframe),
          ),
        );
        await this.resolveExisting(session, assetPath);
        return {
          id: screen.id,
          title: screen.title,
          route: screen.route,
          summary: screen.purpose,
          purpose: screen.purpose,
          image: `protoraft-asset:${assetPath}`,
          stage: screen.stage ?? "wireframe",
          position: node.position ?? { x: 0, y: 0 },
          entry: screen.entry ?? [],
          actions: screen.actions ?? [],
          states: screen.states ?? [],
          linkedDocumentIds: screen.linkedDocuments ?? [],
          updatedAt: "Repository version",
        };
      }),
    );

    const documents = await Promise.all(
      session.manifest.documents.map(async (document) => {
        const documentPath = await this.resolveExisting(session, document.path);
        const content = await readFile(documentPath, "utf8");
        return {
          id: document.id,
          title: document.title,
          filename: normalizeProjectPath(document.path),
          summary: content
            .split("\n")
            .find((line) => line.trim() && !line.startsWith("#"))
            ?.trim()
            .slice(0, 100) ?? "Markdown document",
          content,
          screenIds: document.screenIds,
          updatedAt: "Repository version",
          status: "draft" as const,
          revision: hashContent(content),
        };
      }),
    );

    let discussions: DiscussionFile["notes"] = [];
    let discussionRevision: string | undefined;
    if (session.manifest.discussions) {
      const discussionPath = await this.resolveExisting(
        session,
        session.manifest.discussions,
      );
      const discussionContent = await readFile(discussionPath, "utf8");
      const discussionFile = JSON.parse(discussionContent) as DiscussionFile;
      discussions = discussionFile.notes ?? [];
      discussionRevision = hashContent(discussionContent);
    }

    const tokenPath = await this.resolveExisting(
      session,
      session.manifest.designSystem.tokens,
    );
    const componentPath = await this.resolveExisting(
      session,
      session.manifest.designSystem.components,
    );
    const tokenSource = await readJson<unknown>(tokenPath);
    const componentSource = await readJson<ComponentsFile>(componentPath);

    const [branches, repositoryRoot, reviewStatus] = await Promise.all([
      this.readBranchSnapshots(session).catch(() => []),
      this.gitRoot(session).catch(() => session.root),
      this.readReviewStatusFile(session),
    ]);

    return {
      projectId: session.id,
      name: session.manifest.name,
      repositoryName: basename(repositoryRoot),
      version: session.manifest.version,
      summary: session.manifest.summary,
      defaultBranch:
        session.manifest.collaboration?.defaultBranch ?? "main",
      screens,
      connections: flow.edges,
      discussions,
      discussionRevision,
      documents,
      tokens: flattenTokens(tokenSource),
      components: (componentSource.components ?? []).map((component) => ({
        id: component.id,
        name: component.name,
        category: component.category ?? "Component",
        variants: component.variants ?? [],
        states: component.states ?? [],
        platforms: (component.platforms ?? [])
          .map(toPlatform)
          .filter(
            (platform): platform is "Web" | "iOS" | "Android" =>
              platform !== null,
          ),
        description: component.description ?? "",
      })),
      branches,
      reviewStatus,
    };
  }

  async loadReviewStatus(projectId: string) {
    return this.readReviewStatusFile(this.get(projectId));
  }

  async siteSourceDirectory(projectId: string) {
    const session = this.get(projectId);
    const commonDirectory = await this.gitCommonDirectory(session);
    if (!commonDirectory) {
      throw new Error("Site publishing requires a Git repository.");
    }
    const directory = join(
      commonDirectory,
      "protoraft",
      "sites",
      session.id,
    );
    await mkdir(directory, { recursive: true });
    return directory;
  }

  async loadProductionProject(projectId: string) {
    const sourceSession = this.get(projectId);
    const branch =
      sourceSession.manifest.collaboration?.defaultBranch ?? "main";
    assertGitRef(branch);

    const candidates = branch.startsWith("origin/")
      ? [branch]
      : [branch, `origin/${branch}`];
    let sourceRef = "";
    for (const candidate of candidates) {
      assertGitRef(candidate);
      const commit = await this.git(
        sourceSession,
        ["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`],
        { allowFailure: true },
      );
      if (commit) {
        sourceRef = candidate;
        break;
      }
    }
    if (!sourceRef) {
      throw new Error(`Default branch ${branch} was not found.`);
    }

    const gitRoot = await this.gitRoot(sourceSession);
    const projectPrefix = await this.projectGitPrefix(sourceSession);
    const temporaryRoot = await mkdtemp(
      join(tmpdir(), "protoraft-production-"),
    );
    const checkoutRoot = join(temporaryRoot, "checkout");
    let worktreeAdded = false;

    try {
      await execFileAsync(
        "git",
        [
          "-C",
          gitRoot,
          "worktree",
          "add",
          "--detach",
          checkoutRoot,
          sourceRef,
        ],
        { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      );
      worktreeAdded = true;

      const projectRoot = projectPrefix
        ? resolve(checkoutRoot, projectPrefix)
        : checkoutRoot;
      const snapshotStore = new ProjectStore();
      const snapshotSession = await snapshotStore.open(projectRoot);
      const snapshot = await snapshotStore.loadProject(snapshotSession.id);
      const screens = await Promise.all(
        snapshot.screens.map(async (screen) => {
          if (!screen.image.startsWith("protoraft-asset:")) {
            return screen;
          }
          const asset = await snapshotStore.readAsset(
            snapshotSession.id,
            screen.image.slice("protoraft-asset:".length),
          );
          return {
            ...screen,
            image: `data:${asset.mimeType};base64,${asset.data}`,
          };
        }),
      );
      const primaryBranch =
        snapshot.branches.find((item) => item.name === branch) ??
        snapshot.branches[0];

      return {
        ...snapshot,
        projectId: sourceSession.id,
        defaultBranch: branch,
        screens,
        branches: primaryBranch
          ? [
              {
                ...primaryBranch,
                name: branch,
                label: "Main",
                changes: [],
              },
            ]
          : [],
        reviewStatus: { state: "not-checked" as const },
      };
    } finally {
      if (worktreeAdded) {
        await execFileAsync(
          "git",
          [
            "-C",
            gitRoot,
            "worktree",
            "remove",
            "--force",
            checkoutRoot,
          ],
          { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
        ).catch(() => undefined);
      }
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  async readAsset(projectId: string, projectPath: string) {
    const session = this.get(projectId);
    const path = await this.resolveExisting(session, projectPath);
    const fileStat = await stat(path);
    if (!fileStat.isFile() || fileStat.size > 12 * 1024 * 1024) {
      throw new Error("Asset must be an image smaller than 12 MB.");
    }
    const mimeType = mimeTypeFor(path);
    const bytes = await readFile(path);
    return {
      path: normalizeProjectPath(projectPath),
      mimeType,
      data: bytes.toString("base64"),
      revision: hashContent(bytes),
    };
  }

  async saveDocument(
    projectId: string,
    projectPath: string,
    content: string,
    expectedRevision?: string,
  ): Promise<SaveDocumentResult> {
    const session = this.get(projectId);
    const normalized = normalizeProjectPath(projectPath);
    const allowed = new Set(
      session.manifest.documents.map((document) =>
        normalizeProjectPath(document.path),
      ),
    );
    if (!allowed.has(normalized)) {
      throw new Error(
        "Only documents declared in protoraft.project.json can be saved.",
      );
    }

    const path = await this.resolveWritable(session, normalized);
    const current = await readFile(path, "utf8");
    const previousRevision = hashContent(current);
    if (expectedRevision && expectedRevision !== previousRevision) {
      throw new Error(
        `REVISION_CONFLICT: expected ${expectedRevision}, found ${previousRevision}`,
      );
    }

    await atomicWrite(path, content);
    return {
      path: normalized,
      previousRevision,
      revision: hashContent(content),
    };
  }

  async addDiscussionNote(
    projectId: string,
    input: {
      screenId: string;
      body: string;
      author?: string;
      expectedRevision?: string;
    },
  ): Promise<AddDiscussionNoteResult> {
    const session = this.get(projectId);
    if (!session.manifest.discussions) {
      throw new Error(
        "This ProtoRaft project does not declare a discussion file.",
      );
    }

    const body = input.body.trim();
    const author = input.author?.trim() || "Team";
    if (!body || body.length > 2000) {
      throw new Error("Discussion notes must contain 1 to 2000 characters.");
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(input.screenId)) {
      throw new Error(`Unsafe screen ID: ${input.screenId}`);
    }
    if (author.length > 120) {
      throw new Error("Discussion note author must be 120 characters or fewer.");
    }

    const path = await this.resolveWritable(
      session,
      session.manifest.discussions,
    );
    const current = await readFile(path, "utf8");
    const currentRevision = hashContent(current);
    if (
      input.expectedRevision &&
      input.expectedRevision !== currentRevision
    ) {
      throw new Error(
        `REVISION_CONFLICT: expected ${input.expectedRevision}, found ${currentRevision}`,
      );
    }

    const discussionFile = JSON.parse(current) as DiscussionFile;
    const note = {
      id: `note_${randomBytes(6).toString("hex")}`,
      screenId: input.screenId,
      author,
      body,
      createdAt: new Date().toISOString(),
    };
    const content = `${JSON.stringify(
      { notes: [...(discussionFile.notes ?? []), note] },
      null,
      2,
    )}\n`;
    await atomicWrite(path, content);

    return {
      note,
      revision: hashContent(content),
    };
  }

  async createWireframeRequest(
    projectId: string,
    input: { title: string; purpose: string; screenType: string },
  ): Promise<WireframeRequest> {
    const session = this.get(projectId);
    const requestDirectory = resolve(session.root, REQUEST_DIRECTORY);
    if (!isInside(session.root, requestDirectory)) {
      throw new Error("Invalid request directory.");
    }
    await mkdir(requestDirectory, { recursive: true });
    const actualDirectory = await realpath(requestDirectory);
    if (!isInside(session.root, actualDirectory)) {
      throw new Error("Request directory escapes the project root.");
    }

    const now = new Date().toISOString();
    const request: WireframeRequest = {
      id: `req_${randomBytes(6).toString("hex")}`,
      projectId,
      title: input.title,
      purpose: input.purpose,
      screenType: input.screenType,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };
    await atomicWrite(
      join(actualDirectory, `${request.id}.json`),
      `${JSON.stringify(request, null, 2)}\n`,
    );
    return request;
  }

  private async readRequest(projectId: string, requestId: string) {
    if (!/^req_[a-f0-9]{12}$/.test(requestId)) {
      throw new Error("Invalid wireframe request ID.");
    }
    const session = this.get(projectId);
    const requestPath = await this.resolveExisting(
      session,
      `${REQUEST_DIRECTORY}/${requestId}.json`,
    );
    return {
      requestPath,
      request: await readJson<WireframeRequest>(requestPath),
    };
  }

  async claimWireframeRequest(
    projectId: string,
    requestId: string,
    agentName: string,
  ) {
    return this.withRequestLock(projectId, requestId, async () => {
      const { requestPath, request } = await this.readRequest(
        projectId,
        requestId,
      );
      if (request.status !== "queued") {
        throw new Error(
          `Wireframe request is already ${request.status}; it cannot be claimed.`,
        );
      }
      const updated: WireframeRequest = {
        ...request,
        status: "claimed",
        claimedBy: agentName,
        claimToken: `claim_${randomBytes(10).toString("hex")}`,
        updatedAt: new Date().toISOString(),
      };
      await atomicWrite(requestPath, `${JSON.stringify(updated, null, 2)}\n`);
      return updated;
    });
  }

  async completeWireframeRequest(
    projectId: string,
    requestId: string,
    input: {
      claimToken: string;
      screenId: string;
      screenDefinitionPath: string;
      wireframePath: string;
    },
  ) {
    return this.withRequestLock(projectId, requestId, async () => {
      const session = this.get(projectId);
      const { requestPath, request } = await this.readRequest(
        projectId,
        requestId,
      );
      if (request.status !== "claimed") {
        throw new Error("Wireframe request must be claimed before completion.");
      }
      if (!request.claimToken || request.claimToken !== input.claimToken) {
        throw new Error("Wireframe claim token does not match.");
      }

      await this.resolveExisting(session, input.screenDefinitionPath);
      await this.resolveExisting(session, input.wireframePath);

      const updated: WireframeRequest = {
        ...request,
        status: "completed",
        screenId: input.screenId,
        screenDefinitionPath: normalizeProjectPath(input.screenDefinitionPath),
        wireframePath: normalizeProjectPath(input.wireframePath),
        updatedAt: new Date().toISOString(),
      };
      delete updated.claimToken;
      await atomicWrite(requestPath, `${JSON.stringify(updated, null, 2)}\n`);
      return updated;
    });
  }

  /** O_EXCL mutex around one request's state transition. A leftover lock is never
   *  stolen or cleaned automatically; the operator must resolve it by hand. */
  private async withRequestLock<T>(
    projectId: string,
    requestId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const { requestPath } = await this.readRequest(projectId, requestId);
    const lockPath = join(dirname(requestPath), `${requestId}.lock`);
    let release: (() => Promise<void>) | null = null;
    try {
      const handle = await open(lockPath, "wx");
      release = async () => {
        await handle.close().catch(() => {});
        await rm(lockPath, { force: true }).catch(() => {});
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(
          `Wireframe request ${requestId} is busy: ${lockPath} already exists. ` +
            `Retry after the other agent finishes; if no agent is running, delete that lock file by hand.`,
        );
      }
      throw error;
    }
    try {
      return await action();
    } finally {
      await release();
    }
  }

  private async gitRoot(session: ProjectSession) {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", session.root, "rev-parse", "--show-toplevel"],
      { encoding: "utf8" },
    );
    return realpath(stdout.trim());
  }

  private async gitCommonDirectory(session: ProjectSession) {
    const commonDirectory = await this.git(
      session,
      ["rev-parse", "--git-common-dir"],
      { allowFailure: true },
    );
    if (!commonDirectory) {
      return null;
    }

    const candidate = isAbsolute(commonDirectory)
      ? commonDirectory
      : resolve(session.root, commonDirectory);
    return realpath(candidate).catch(() => null);
  }

  private async readReviewStatusFile(session: ProjectSession) {
    const commonDirectory = await this.gitCommonDirectory(session);
    if (!commonDirectory) {
      return { state: "not-checked" as const };
    }

    try {
      const status = await readJson<ReviewStatusFile>(
        join(
          commonDirectory,
          REVIEW_STATUS_DIRECTORY,
          REVIEW_STATUS_FILE,
        ),
      );
      if (
        status.schemaVersion !== "0.1" ||
        !status.state ||
        !["current", "updates-available", "error"].includes(status.state)
      ) {
        throw new Error("Unsupported review status.");
      }

      return {
        state: status.state,
        checkedAt:
          typeof status.checkedAt === "string"
            ? status.checkedAt
            : undefined,
        summary:
          typeof status.summary === "string"
            ? status.summary.slice(0, 240)
            : undefined,
        changedArtifacts:
          typeof status.changedArtifacts === "number" &&
          Number.isInteger(status.changedArtifacts) &&
          status.changedArtifacts >= 0
            ? status.changedArtifacts
            : undefined,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { state: "not-checked" as const };
      }
      return {
        state: "error" as const,
        summary: "Canvas freshness status could not be read.",
      };
    }
  }

  private async git(
    session: ProjectSession,
    args: string[],
    options?: { allowFailure?: boolean },
  ) {
    try {
      const result = await execFileAsync("git", ["-C", session.root, ...args], {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
      });
      return result.stdout.trim();
    } catch (error) {
      if (options?.allowFailure) {
        return "";
      }
      throw error;
    }
  }

  private async projectGitPrefix(session: ProjectSession) {
    const gitRoot = await this.gitRoot(session);
    return normalizeProjectPath(relative(gitRoot, session.root));
  }

  private async readGitFilePreview(
    session: ProjectSession,
    ref: string,
    projectPath: string,
    prefix: string,
  ) {
    assertGitRef(ref);
    assertRelativePath(projectPath);
    if (!TEXT_PREVIEW_EXTENSIONS.has(extname(projectPath).toLowerCase())) {
      return `[Binary preview omitted: ${projectPath}]`;
    }

    const repositoryPath = prefix ? `${prefix}/${projectPath}` : projectPath;
    const object = `${ref}:${repositoryPath}`;
    const sizeText = await this.git(session, ["cat-file", "-s", object], {
      allowFailure: true,
    });
    if (!sizeText) {
      return `[Not present on ${ref}]`;
    }

    const size = Number(sizeText);
    if (!Number.isFinite(size) || size > MAX_GIT_PREVIEW_BYTES) {
      return `[Text preview omitted: ${projectPath} is larger than 64 KiB]`;
    }

    return this.git(session, ["show", object], { allowFailure: true });
  }

  private async readBranchSnapshots(session: ProjectSession) {
    const defaultBranch =
      session.manifest.collaboration?.defaultBranch ?? "main";
    const current =
      (await this.git(session, ["branch", "--show-current"], {
        allowFailure: true,
      })) || defaultBranch;
    const localRefs = (
      await this.git(session, [
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads",
      ])
    )
      .split("\n")
      .filter(Boolean);
    const remoteRefs = (
      await this.git(session, [
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/remotes",
      ])
    )
      .split("\n")
      .filter((ref) => ref && !ref.endsWith("/HEAD"));
    const remoteByName = new Map<string, string>();
    for (const ref of remoteRefs) {
      const name = ref.split("/").slice(1).join("/");
      if (name && (!remoteByName.has(name) || ref.startsWith("origin/"))) {
        remoteByName.set(name, ref);
      }
    }
    const orderedNames = [
      defaultBranch,
      current,
      ...localRefs,
      ...remoteByName.keys(),
    ].filter((name, index, all) => all.indexOf(name) === index);
    const ordered: GitBranchCandidate[] = orderedNames.map((name) => ({
      name,
      ref: localRefs.includes(name) ? name : (remoteByName.get(name) ?? name),
    }));
    const prefix = await this.projectGitPrefix(session);
    const available: GitBranchCandidate[] = [];
    for (const candidate of ordered) {
      const exists = await this.git(
        session,
        ["rev-parse", "--verify", `${candidate.ref}^{commit}`],
        { allowFailure: true },
      );
      if (exists) {
        available.push(candidate);
      }
      if (available.length === 2) {
        break;
      }
    }

    const reviewScenario = await this.readReviewScenario(
      session,
      available[0]?.name,
      available[1]?.name,
    );
    const snapshots = [];
    for (const [index, candidate] of available.entries()) {
      const commit = await this.git(session, [
        "rev-parse",
        "--short",
        candidate.ref,
      ]);
      const author = await this.git(session, [
        "show",
        "-s",
        "--format=%an",
        candidate.ref,
      ]);
      const updatedAt = await this.git(session, [
        "show",
        "-s",
        "--format=%cs",
        candidate.ref,
      ]);
      let changes: Array<{
        path: string;
        kind: "added" | "modified" | "deleted" | "conflict";
        area: "Wireframe" | "Document" | "Design system" | "HiFi";
        summary: string;
        baseContent?: string;
        compareContent?: string;
        recommendation?: string;
      }> = [];
      if (index > 0) {
        const comparison = await this.compareBranches(
          session.id,
          available[0]!.ref,
          candidate.ref,
          true,
        );
        const reviewOrder = new Map(
          (reviewScenario?.changes ?? []).map((change, reviewIndex) => [
            normalizeProjectPath(change.path),
            reviewIndex,
          ]),
        );
        const orderedFiles = [...comparison.changedFiles].sort(
          (left, right) =>
            (reviewOrder.get(left.path) ?? Number.MAX_SAFE_INTEGER) -
            (reviewOrder.get(right.path) ?? Number.MAX_SAFE_INTEGER),
        );
        changes = await Promise.all(
          orderedFiles.map(async (file) => {
            const review = reviewScenario?.changes?.find(
              (change) => normalizeProjectPath(change.path) === file.path,
            );
            return {
              path: file.path,
              kind: comparison.possibleConflicts.includes(file.path)
                ? ("conflict" as const)
                : file.kind === "renamed"
                  ? ("modified" as const)
                  : file.kind,
              area: file.path.startsWith("documents/")
                ? ("Document" as const)
                : file.path.startsWith("design/")
                  ? ("Design system" as const)
                  : file.path.startsWith("hifi/")
                    ? ("HiFi" as const)
                    : ("Wireframe" as const),
              summary: review?.summary ?? `${file.kind} on ${candidate.name}`,
              baseContent: await this.readGitFilePreview(
                session,
                available[0]!.ref,
                file.path,
                prefix,
              ),
              compareContent: await this.readGitFilePreview(
                session,
                candidate.ref,
                file.path,
                prefix,
              ),
              recommendation: review?.recommendation,
            };
          }),
        );
      }
      snapshots.push({
        name: candidate.name,
        gitRef: candidate.ref,
        label: candidate.name === defaultBranch ? "Main" : candidate.name,
        author,
        commit,
        updatedAt,
        changes,
      });
    }
    return snapshots;
  }

  private async readReviewScenario(
    session: ProjectSession,
    base?: string,
    compare?: string,
  ) {
    const scenarioPath = session.manifest.collaboration?.reviewScenarios;
    if (!scenarioPath || !base || !compare) {
      return undefined;
    }
    const path = await this.resolveExisting(session, scenarioPath);
    const source = await readJson<ReviewScenariosFile>(path);
    return source.comparisons?.find(
      (scenario) =>
        scenario.base === base && scenario.compare === compare,
    );
  }

  async compareBranches(
    projectId: string,
    base: string,
    compare: string,
    scanConflicts = true,
  ): Promise<BranchComparison> {
    const session = this.get(projectId);
    assertGitRef(base);
    assertGitRef(compare);
    await this.git(session, ["rev-parse", "--verify", `${base}^{commit}`]);
    await this.git(session, ["rev-parse", "--verify", `${compare}^{commit}`]);
    const mergeBase = await this.git(session, ["merge-base", base, compare]);
    const prefix = await this.projectGitPrefix(session);
    const pathSpec = prefix || ".";
    const nameStatus = await this.git(session, [
      "diff",
      "--name-status",
      `${base}...${compare}`,
      "--",
      pathSpec,
    ]);

    const changedFiles = nameStatus
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [statusCode, firstPath, secondPath] = line.split("\t");
        const rawPath = secondPath ?? firstPath ?? "";
        const projectPath =
          prefix && rawPath.startsWith(`${prefix}/`)
            ? rawPath.slice(prefix.length + 1)
            : rawPath;
        const initial = statusCode?.[0];
        const kind =
          initial === "A"
            ? ("added" as const)
            : initial === "D"
              ? ("deleted" as const)
              : initial === "R"
                ? ("renamed" as const)
                : ("modified" as const);
        return { path: projectPath, kind };
      });

    let possibleConflicts: string[] = [];
    if (scanConflicts) {
      const mergeTree = await this.git(
        session,
        ["merge-tree", mergeBase, base, compare],
        { allowFailure: true },
      );
      const conflictPaths = new Set<string>();
      let inConflictSection = false;
      for (const line of mergeTree.split("\n")) {
        const section = line.trim();
        if (
          section === "changed in both" ||
          section === "added in both" ||
          section === "removed in local" ||
          section === "removed in remote"
        ) {
          inConflictSection = true;
          continue;
        }
        if (
          section === "merged" ||
          section === "added in local" ||
          section === "added in remote" ||
          section === "removed in both"
        ) {
          inConflictSection = false;
          continue;
        }
        if (!inConflictSection) {
          continue;
        }
        const match = line.match(
          /^\s*(?:base|our|their)\s+\d+\s+[a-f0-9]+\s+(.+)$/,
        );
        if (match?.[1]) {
          const rawPath = match[1];
          const projectPath =
            prefix && rawPath.startsWith(`${prefix}/`)
              ? rawPath.slice(prefix.length + 1)
              : rawPath;
          if (!prefix || rawPath.startsWith(`${prefix}/`)) {
            conflictPaths.add(projectPath);
          }
        }
      }
      possibleConflicts = [...conflictPaths];
    }

    return {
      base,
      compare,
      mergeBase,
      changedFiles,
      possibleConflicts,
    };
  }
}

export { hashContent };
