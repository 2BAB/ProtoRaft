import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  readRecentDiagnostics,
  recordDiagnostic,
  trackDiagnostic,
} from "./diagnostics";
import { ProjectStore } from "./project-store";
import { prepareSiteExport } from "./site-export";

const UI_URI = "ui://protoraft/workbench.html";
const DIST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const store = new ProjectStore();

function result(payload: Record<string, unknown>, message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent: payload,
  };
}

function createServer() {
  const server = new McpServer({
    name: "protoraft",
    version: "1.2.0",
  });

  registerAppResource(
    server,
    "ProtoRaft workbench",
    UI_URI,
    {
      description:
        "Interactive ProtoRaft workspace for wireframes, product documents, design systems, HiFi previews, and Git comparison.",
    },
    async () => {
      const html = await readFile(join(DIST_DIRECTORY, "index.html"), "utf8");
      return {
        contents: [
          {
            uri: UI_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                csp: {
                  connectDomains: [],
                  resourceDomains: [],
                },
              },
            },
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_protoraft_diagnostics",
    {
      title: "Read ProtoRaft diagnostics",
      description:
        "Read recent redacted ProtoRaft MCP and host-handoff events from the local diagnostic log.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).default(50),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit }) => {
      const diagnostics = await readRecentDiagnostics(limit);
      return result(
        { diagnostics },
        `Read ${diagnostics.entries.length} recent ProtoRaft diagnostic events.`,
      );
    },
  );

  registerAppTool(
    server,
    "open_protoraft_workbench",
    {
      title: "Open ProtoRaft workbench",
      description:
        "Open an existing ProtoRaft project from a local Git repository in the interactive workbench.",
      inputSchema: {
        rootPath: z
          .string()
          .min(1)
          .describe(
            "Absolute path to the repository directory containing protoraft.project.json.",
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["model"],
        },
      },
    },
    async ({ rootPath }) =>
      trackDiagnostic("mcp", "tool.open-workbench", {}, async () => {
        const session = await store.open(rootPath);
        const project = await store.loadProject(session.id);
        return result(
          { project },
          `Opened ProtoRaft project ${project.name} v${project.version}.`,
        );
      }),
  );

  registerAppTool(
    server,
    "get_protoraft_project",
    {
      title: "Refresh ProtoRaft project",
      description:
        "Read the current project manifest, flow, documents, tokens, components, and local branch summary.",
      inputSchema: {
        projectId: z.string().min(1),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app"],
        },
      },
    },
    async ({ projectId }) => {
      const project = await store.loadProject(projectId);
      return result({ project }, `Refreshed ${project.name}.`);
    },
  );

  registerAppTool(
    server,
    "get_protoraft_production_project",
    {
      title: "Load ProtoRaft production view",
      description:
        "Read a self-contained, read-only project snapshot from the repository default branch.",
      inputSchema: {
        projectId: z.string().min(1),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app"],
        },
      },
    },
    async ({ projectId }) => {
      const project = await store.loadProductionProject(projectId);
      return result(
        { project },
        `Loaded the ${project.defaultBranch} production view for ${project.name}.`,
      );
    },
  );

  registerAppTool(
    server,
    "get_protoraft_review_status",
    {
      title: "Refresh ProtoRaft review status",
      description:
        "Read the latest local canvas-freshness result for the active Git repository.",
      inputSchema: {
        projectId: z.string().min(1),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app"],
        },
      },
    },
    async ({ projectId }) => {
      const reviewStatus = await store.loadReviewStatus(projectId);
      return result({ reviewStatus }, "Refreshed ProtoRaft review status.");
    },
  );

  registerAppTool(
    server,
    "record_protoraft_host_event",
    {
      title: "Record ProtoRaft host handoff",
      description:
        "Record whether the MCP App started, handed off, or failed a Codex-hosted workflow without storing prompt content.",
      inputSchema: {
        projectId: z.string().min(1),
        action: z.enum([
          "schedule-task",
          "publish-site",
          "generate-wireframe",
          "sync-native-core",
          "review-conflict",
        ]),
        status: z.enum(["started", "accepted", "rejected"]),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app"],
        },
      },
    },
    async ({ projectId, action, status }) => {
      await recordDiagnostic({
        component: "app",
        event: `host.${action}`,
        status,
        projectId,
      });
      return result(
        { recorded: true },
        `Recorded ProtoRaft host handoff ${action}: ${status}.`,
      );
    },
  );

  registerAppTool(
    server,
    "list_protoraft_publication_sources",
    {
      title: "List shareable Git snapshots",
      description: "Find the exact commits available for Production and branch review.",
      inputSchema: { projectId: z.string().min(1) },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ projectId }) => {
      const sources = await store.listPublicationSources(projectId);
      return result({ sources }, `Found ${sources.length} shareable Git snapshots.`);
    },
  );

  registerAppTool(
    server,
    "prepare_protoraft_site",
    {
      title: "Prepare ProtoRaft review site",
      description:
        "Prepare a read-only Codex Sites snapshot from a pinned Production or branch-review commit.",
      inputSchema: {
        projectId: z.string().min(1),
        source: z.object({
          kind: z.enum(["production", "branch-review"]),
          branch: z.string().min(1),
          commit: z.string().regex(/^[a-f0-9]{40,64}$/),
          baseBranch: z.string().min(1).optional(),
          baseCommit: z.string().regex(/^[a-f0-9]{40,64}$/).optional(),
        }).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app", "model"],
        },
      },
    },
    async ({ projectId, source }) =>
      trackDiagnostic(
        "mcp",
        "tool.prepare-site",
        { projectId },
        async () => {
          const site = await prepareSiteExport({
            store,
            projectId,
            source,
            uiTemplatePath: join(DIST_DIRECTORY, "index.html"),
          });
          return result(
            { site },
            `Prepared ${site.projectName} from ${site.branch} at ${site.commit.slice(0, 7)}.`,
          );
        },
      ),
  );

  registerAppTool(
    server,
    "get_protoraft_asset",
    {
      title: "Read ProtoRaft image",
      description:
        "Read one project image as base64 for the interactive workbench.",
      inputSchema: {
        projectId: z.string().min(1),
        path: z.string().min(1),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app"],
        },
      },
    },
    async ({ projectId, path }) => {
      const asset = await store.readAsset(projectId, path);
      return result({ asset }, `Read ${asset.path}.`);
    },
  );

  registerAppTool(
    server,
    "save_protoraft_document",
    {
      title: "Save ProtoRaft document",
      description:
        "Atomically save a Markdown document declared by the active ProtoRaft project.",
      inputSchema: {
        projectId: z.string().min(1),
        path: z.string().min(1),
        content: z.string(),
        expectedRevision: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app"],
        },
      },
    },
    async ({ projectId, path, content, expectedRevision }) =>
      trackDiagnostic(
        "mcp",
        "tool.save-document",
        { projectId },
        async () => {
          const saved = await store.saveDocument(
            projectId,
            path,
            content,
            expectedRevision,
          );
          return result({ saved }, `Saved ${saved.path}.`);
        },
      ),
  );

  registerAppTool(
    server,
    "add_protoraft_discussion_note",
    {
      title: "Add wireframe discussion note",
      description:
        "Append one short, screen-linked discussion note to the active ProtoRaft project.",
      inputSchema: {
        projectId: z.string().min(1),
        screenId: z.string().min(1).max(120),
        body: z.string().min(1).max(2000),
        author: z.string().min(1).max(120).optional(),
        expectedRevision: z.string().optional(),
        noteId: z.string().regex(/^note_[a-f0-9]{32}$/).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app"],
        },
      },
    },
    async ({
      projectId,
      screenId,
      body,
      author,
      expectedRevision,
      noteId,
    }) =>
      trackDiagnostic(
        "mcp",
        "tool.add-discussion-note",
        { projectId },
        async () => {
          const saved = await store.addDiscussionNote(projectId, {
            screenId,
            body,
            author,
            expectedRevision,
            noteId,
          });
          return result(
            { saved },
            `Added a discussion note to ${saved.note.screenId}.`,
          );
        },
      ),
  );

  registerAppTool(
    server,
    "create_wireframe_request",
    {
      title: "Queue wireframe generation",
      description:
        "Create a durable atomic wireframe request for a Codex agent to claim and complete.",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().min(1).max(120),
        purpose: z.string().min(1).max(2000),
        screenType: z.string().min(1).max(80),
        sourceScreenId: z.string().min(1).max(100).optional(),
        requestId: z.string().regex(/^req_[a-f0-9]{12}$/).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app"],
        },
      },
    },
    async ({ projectId, title, purpose, screenType, sourceScreenId, requestId }) =>
      trackDiagnostic(
        "mcp",
        "tool.create-wireframe-request",
        { projectId },
        async () => {
          const request = await store.createWireframeRequest(projectId, {
            title,
            purpose,
            screenType,
            sourceScreenId,
            requestId,
          });
          return result(
            { request },
            `Queued atomic wireframe request ${request.id} for ${request.title}.`,
          );
        },
      ),
  );

  registerAppTool(
    server,
    "list_wireframe_requests",
    {
      title: "List wireframe requests",
      description: "Read generation progress and completed screen IDs without exposing claim tokens.",
      inputSchema: { projectId: z.string().min(1) },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { visibility: ["app", "model"] } },
    },
    async ({ projectId }) => {
      const requests = await store.listWireframeRequests(projectId);
      return result({ requests }, `Loaded ${requests.length} wireframe requests.`);
    },
  );

  registerAppTool(
    server,
    "retry_wireframe_request",
    {
      title: "Retry wireframe generation",
      description: "Return a failed or timed-out wireframe to the queue.",
      inputSchema: {
        projectId: z.string().min(1),
        requestId: z.string().regex(/^req_[a-f0-9]{12}$/),
      },
      annotations: { destructiveHint: false, openWorldHint: false },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ projectId, requestId }) => {
      const request = await store.retryWireframeRequest(projectId, requestId);
      return result({ request }, `Queued ${request.id} for retry.`);
    },
  );

  server.registerTool(
    "fail_wireframe_request",
    {
      title: "Report failed wireframe generation",
      description: "Keep a failed generation visible in the workbench and let the user retry.",
      inputSchema: {
        projectId: z.string().min(1),
        requestId: z.string().regex(/^req_[a-f0-9]{12}$/),
        claimToken: z.string().regex(/^claim_[a-f0-9]{20}$/),
        error: z.string().min(1).max(500),
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ projectId, requestId, claimToken, error }) => {
      const request = await store.failWireframeRequest(projectId, requestId, claimToken, error);
      return result({ request }, `Recorded failure for ${request.id}.`);
    },
  );

  server.registerTool(
    "claim_wireframe_request",
    {
      title: "Claim wireframe request",
      description:
        "Claim one queued ProtoRaft wireframe request before generating any files.",
      inputSchema: {
        projectId: z.string().min(1),
        requestId: z.string().regex(/^req_[a-f0-9]{12}$/),
        agentName: z.string().min(1).max(120),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, requestId, agentName }) =>
      trackDiagnostic(
        "mcp",
        "tool.claim-wireframe-request",
        { projectId },
        async () => {
          const request = await store.claimWireframeRequest(
            projectId,
            requestId,
            agentName,
          );
          const rootPath = store.get(projectId).root;
          const screenId = `screen-${requestId.slice(4)}-${request.claimToken!.slice(-6)}`;
          const screenDirectory = `screens/${screenId}`;
          return result(
            {
              request,
              rootPath,
              output: {
                screenId,
                screenDefinitionPath: `${screenDirectory}/screen.json`,
                wireframePath: `${screenDirectory}/wireframe.png`,
              },
            },
            `Claimed ${request.id}. Use claim token ${request.claimToken} when completing it.`,
          );
        },
      ),
  );

  server.registerTool(
    "complete_wireframe_request",
    {
      title: "Complete wireframe request",
      description:
        "Validate a generated PNG and its screen definition, place the screen on the project canvas, and complete the request.",
      inputSchema: {
        projectId: z.string().min(1),
        requestId: z.string().regex(/^req_[a-f0-9]{12}$/),
        claimToken: z.string().regex(/^claim_[a-f0-9]{20}$/),
        screenId: z.string().min(1).max(100),
        screenDefinitionPath: z.string().min(1),
        wireframePath: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      projectId,
      requestId,
      claimToken,
      screenId,
      screenDefinitionPath,
      wireframePath,
    }) =>
      trackDiagnostic(
        "mcp",
        "tool.complete-wireframe-request",
        { projectId },
        async () => {
          const request = await store.completeWireframeRequest(
            projectId,
            requestId,
            {
              claimToken,
              screenId,
              screenDefinitionPath,
              wireframePath,
            },
          );
          return result(
            { request },
            `Completed ${request.id} with screen ${request.screenId}.`,
          );
        },
      ),
  );

  registerAppTool(
    server,
    "get_protoraft_branch_images",
    {
      title: "Read wireframe images from compared commits",
      description: "Load the two committed versions of a changed image.",
      inputSchema: {
        projectId: z.string().min(1),
        base: z.string().regex(/^[a-f0-9]{40,64}$/),
        compare: z.string().regex(/^[a-f0-9]{40,64}$/),
        path: z.string().min(1),
        previousPath: z.string().min(1).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ projectId, base, compare, path, previousPath }) =>
      result(await store.readBranchImages(projectId, base, compare, path, previousPath), "Loaded committed wireframe images."),
  );

  registerAppTool(
    server,
    "save_protoraft_review_decision",
    {
      title: "Save a product decision for branch review",
      description: "Record the decision against a declared review artifact in the local Git working tree.",
      inputSchema: {
        projectId: z.string().min(1),
        base: z.string().min(1),
        compare: z.string().min(1),
        path: z.string().min(1),
        decision: z.string().trim().min(1).max(2000),
        expectedRevision: z.string().min(1),
      },
      annotations: { destructiveHint: false, openWorldHint: false },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ projectId, ...input }) => {
      const saved = await store.saveReviewDecision(projectId, input);
      return result({ saved }, "Saved the product decision to the review scenario.");
    },
  );

  registerAppTool(
    server,
    "compare_protoraft_branches",
    {
      title: "Compare ProtoRaft branches",
      description:
        "Read changed project artifacts and scan likely merge conflicts between two local Git refs.",
      inputSchema: {
        projectId: z.string().min(1),
        base: z.string().min(1),
        compare: z.string().min(1),
        scanConflicts: z.boolean().default(true),
        includeReview: z.boolean().default(false),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_URI,
          visibility: ["app", "model"],
        },
      },
    },
    async ({ projectId, base, compare, scanConflicts, includeReview }) =>
      trackDiagnostic(
        "mcp",
        "tool.compare-branches",
        { projectId },
        async () => {
          const comparison = await store.compareBranches(
            projectId,
            base,
            compare,
            scanConflicts,
          );
          const branches = includeReview ? await store.loadBranchReview(projectId, base, compare) : undefined;
          return result(
            { comparison, branches },
            `Compared ${comparison.base} with ${comparison.compare}: ${comparison.changedFiles.length} changed files and ${comparison.possibleConflicts.length} possible conflicts.`,
          );
        },
      ),
  );

  return server;
}

async function main() {
  if (!process.argv.includes("--stdio")) {
    throw new Error("ProtoRaft supports stdio transport only.");
  }
  await trackDiagnostic("mcp", "server.start", {}, async () => {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  });
  console.error("ProtoRaft MCP server ready on stdio.");
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { createServer };
