import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../mcp/server";

const pixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function createProjectFixture(root: string) {
  await mkdir(join(root, "flows"), { recursive: true });
  await mkdir(join(root, "screens/today"), { recursive: true });
  await mkdir(join(root, "documents"), { recursive: true });
  await mkdir(join(root, "design"), { recursive: true });
  await writeFile(
    join(root, "protoraft.project.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      projectId: "mcp-fixture",
      name: "MCP Fixture",
      version: "0.1",
      summary: "Repository-backed MCP test project",
      flow: "flows/main.flow.json",
      documents: [
        {
          id: "brief",
          title: "Brief",
          path: "documents/brief.md",
          screenIds: ["today"],
        },
      ],
      designSystem: {
        tokens: "design/tokens.tokens.json",
        components: "design/components.json",
      },
    }),
  );
  await writeFile(
    join(root, "flows/main.flow.json"),
    JSON.stringify({
      nodes: [
        {
          id: "today",
          screen: "screens/today/screen.json",
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    }),
  );
  await writeFile(
    join(root, "screens/today/screen.json"),
    JSON.stringify({
      id: "today",
      title: "Today",
      route: "/today",
      purpose: "Open the test project.",
      wireframe: "wireframe.png",
      actions: [{ label: "Stay", target: "today" }],
      states: ["Default"],
      linkedDocuments: ["brief"],
    }),
  );
  await writeFile(join(root, "screens/today/wireframe.png"), pixelPng);
  await writeFile(join(root, "documents/brief.md"), "# Brief\n\nTest.\n");
  await writeFile(join(root, "design/tokens.tokens.json"), "{}");
  await writeFile(
    join(root, "design/components.json"),
    JSON.stringify({ components: [] }),
  );
}

describe("ProtoRaft MCP server", () => {
  const connected: Array<{
    client: Client;
    server: ReturnType<typeof createServer>;
  }> = [];
  const fixtureRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      connected.splice(0).map(async ({ client, server }) => {
        await client.close();
        await server.close();
      }),
    );
    await Promise.all(
      fixtureRoots.splice(0).map((root) =>
        rm(root, { recursive: true, force: true }),
      ),
    );
  });

  it("lists the workbench tools and opens a repository project", async () => {
    const root = await mkdtemp(join(tmpdir(), "protoraft-mcp-"));
    fixtureRoots.push(root);
    await createProjectFixture(root);
    const server = createServer();
    const client = new Client({
      name: "protoraft-test-client",
      version: "0.1.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    connected.push({ client, server });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "get_protoraft_diagnostics",
        "open_protoraft_workbench",
        "get_protoraft_project",
        "get_protoraft_production_project",
        "get_protoraft_review_status",
        "record_protoraft_host_event",
        "prepare_protoraft_site",
        "save_protoraft_document",
        "add_protoraft_discussion_note",
        "create_wireframe_request",
        "list_wireframe_requests",
        "retry_wireframe_request",
        "fail_wireframe_request",
        "claim_wireframe_request",
        "complete_wireframe_request",
        "compare_protoraft_branches",
      ]),
    );

    const opened = await client.callTool({
      name: "open_protoraft_workbench",
      arguments: {
        rootPath: root,
      },
    });
    const structured = opened.structuredContent as
      | { project?: { name?: string; screens?: unknown[] } }
      | undefined;

    expect(opened.isError).not.toBe(true);
    expect(structured?.project?.name).toBe("MCP Fixture");
    expect(structured?.project?.screens).toHaveLength(1);
  });
});
