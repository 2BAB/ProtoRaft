import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashContent, ProjectStore } from "../mcp/project-store";
import { prepareSiteExport } from "../mcp/site-export";

const pixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function createFixture(root: string) {
  await mkdir(join(root, "flows"), { recursive: true });
  await mkdir(join(root, "screens/today"), { recursive: true });
  await mkdir(join(root, "documents"), { recursive: true });
  await mkdir(join(root, "design"), { recursive: true });
  await mkdir(join(root, "collaboration"), { recursive: true });

  await writeFile(
    join(root, "protoraft.project.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      projectId: "fixture",
      name: "Fixture",
      version: "0.1",
      summary: "Fixture project",
      flow: "flows/main.flow.json",
      discussions: "documents/discussions.json",
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
      collaboration: {
        defaultBranch: "main",
        reviewScenarios: "collaboration/review-scenarios.json",
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
          position: { x: 20, y: 40 },
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
      purpose: "Open the daily edition.",
      wireframe: "wireframe.png",
      entry: ["Launch"],
      actions: [],
      states: ["Default"],
      linkedDocuments: ["brief"],
    }),
  );
  await writeFile(join(root, "screens/today/wireframe.png"), pixelPng);
  await writeFile(join(root, "documents/brief.md"), "# Fixture\n\nOriginal.\n");
  await writeFile(
    join(root, "documents/discussions.json"),
    JSON.stringify({ notes: [] }),
  );
  await writeFile(
    join(root, "design/tokens.tokens.json"),
    JSON.stringify({
      color: {
        ink: {
          $type: "color",
          $value: "#171717",
          $description: "Primary ink",
        },
      },
    }),
  );
  await writeFile(
    join(root, "design/components.json"),
    JSON.stringify({
      components: [
        {
          id: "story-card",
          name: "Story card",
          category: "Content",
          variants: ["Default"],
          states: ["Idle"],
          platforms: ["web", "ios", "android"],
        },
      ],
    }),
  );
  await writeFile(
    join(root, "collaboration/review-scenarios.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      comparisons: [
        {
          base: "main",
          compare: "feature/listen",
          changes: [
            {
              path: "documents/brief.md",
              summary: "Both branches changed the fixture brief.",
              recommendation: "Keep the feature intent with the main wording.",
            },
          ],
        },
      ],
    }),
  );
}

describe("ProjectStore", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "protoraft-store-"));
    await createFixture(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("loads a project behind an opaque session ID", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const project = await store.loadProject(session.id);

    expect(session.id).toMatch(/^prj_[a-f0-9]{16}$/);
    expect(session.id).not.toContain(root);
    expect(project.name).toBe("Fixture");
    expect(project.repositoryName).toBe(root.split("/").at(-1));
    expect(project.reviewStatus).toEqual({ state: "not-checked" });
    expect(project.screens[0]?.image).toBe(
      "protoraft-asset:screens/today/wireframe.png",
    );
    expect(project.tokens[0]).toMatchObject({
      path: "color.ink",
      value: "#171717",
      swatch: "#171717",
    });
  });

  it("reads the local review status from the Git common directory", async () => {
    execFileSync("git", ["init", "-b", "main"], { cwd: root });
    await mkdir(join(root, ".git/protoraft"), { recursive: true });
    await writeFile(
      join(root, ".git/protoraft/review-status.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        state: "updates-available",
        checkedAt: "2026-07-28T09:00:00+08:00",
        summary: "2 artifacts may need review.",
        changedArtifacts: 2,
      }),
    );

    const store = new ProjectStore();
    const session = await store.open(root);
    expect(await store.loadReviewStatus(session.id)).toEqual({
      state: "updates-available",
      checkedAt: "2026-07-28T09:00:00+08:00",
      summary: "2 artifacts may need review.",
      changedArtifacts: 2,
    });
  });

  it("loads Production from main without including local changes", async () => {
    execFileSync("git", ["init", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.name", "ProtoRaft Test"], {
      cwd: root,
    });
    execFileSync("git", ["config", "user.email", "test@example.com"], {
      cwd: root,
    });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });
    await writeFile(
      join(root, "documents/brief.md"),
      "# Fixture\n\nUncommitted local draft.\n",
    );

    const store = new ProjectStore();
    const session = await store.open(root);
    const local = await store.loadProject(session.id);
    const production = await store.loadProductionProject(session.id);

    expect(local.documents[0]?.content).toContain("Uncommitted local draft");
    expect(production.documents[0]?.content).toContain("Original.");
    expect(production.screens[0]?.image).toMatch(/^data:image\/png;base64,/);
    expect(production.branches.map((branch) => branch.name)).toEqual(["main"]);
    expect(
      execFileSync("git", ["status", "--short"], {
        cwd: root,
        encoding: "utf8",
      }),
    ).toContain("documents/brief.md");
  }, 10_000);

  it("prepares a locked Production site that serves independently", async () => {
    execFileSync("git", ["init", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.name", "ProtoRaft Test"], {
      cwd: root,
    });
    execFileSync("git", ["config", "user.email", "test@example.com"], {
      cwd: root,
    });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });
    const templatePath = join(root, "ui-template.html");
    await writeFile(
      templatePath,
      "<!doctype html><html><head><title>ProtoRaft</title></head><body><div id=\"root\"></div><script type=\"module\">document.querySelector('#root').textContent='ready';</script></body></html>",
    );
    const store = new ProjectStore();
    const session = await store.open(root);
    const site = await prepareSiteExport({
      store,
      projectId: session.id,
      uiTemplatePath: templatePath,
    });

    try {
      const html = await readFile(join(site.sourceDirectory, "index.html"), "utf8");
      expect(html).toContain("__PROTORAFT_BOOTSTRAP__");
      expect(html).toContain('"displayMode":"prod"');
      expect(html).toContain('"locked":true');
      expect(site.branch).toBe("main");

      await writeFile(
        join(site.sourceDirectory, ".openai/hosting.json"),
        `${JSON.stringify({
          project_id: "site_fixture",
          d1: null,
          r2: null,
        })}\n`,
      );
      const refreshedSite = await prepareSiteExport({
        store,
        projectId: session.id,
        uiTemplatePath: templatePath,
      });
      expect(refreshedSite.sourceDirectory).toBe(site.sourceDirectory);
      expect(
        JSON.parse(
          await readFile(
            join(site.sourceDirectory, ".openai/hosting.json"),
            "utf8",
          ),
        ),
      ).toMatchObject({ project_id: "site_fixture" });

      const workerUrl = pathToFileURL(
        join(site.sourceDirectory, "dist/server/index.js"),
      );
      workerUrl.searchParams.set("test", String(Date.now()));
      const worker = (await import(workerUrl.href)) as {
        default: { fetch: (request: Request) => Promise<Response> };
      };
      const response = await worker.default.fetch(
        new Request("https://example.test/"),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("__PROTORAFT_BOOTSTRAP__");
    } finally {
      await rm(site.sourceDirectory, { recursive: true, force: true });
    }
  }, 10_000);

  it("limits writes to declared documents and detects revision conflicts", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const original = "# Fixture\n\nOriginal.\n";
    const first = await store.saveDocument(
      session.id,
      "documents/brief.md",
      "# Fixture\n\nUpdated.\n",
      hashContent(original),
    );

    expect(first.previousRevision).toBe(hashContent(original));
    await expect(
      store.saveDocument(
        session.id,
        "documents/brief.md",
        "Conflicting write",
        hashContent(original),
      ),
    ).rejects.toThrow("REVISION_CONFLICT");
    await expect(
      store.saveDocument(session.id, "README.md", "Not allowed"),
    ).rejects.toThrow("Only documents declared");
  });

  it("appends screen-linked discussion notes with revision checks", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const project = await store.loadProject(session.id);
    const saved = await store.addDiscussionNote(session.id, {
      screenId: "today",
      body: "Make the primary action easier to spot.",
      author: "Review team",
      expectedRevision: project.discussionRevision,
    });

    expect(saved.note).toMatchObject({
      screenId: "today",
      author: "Review team",
      body: "Make the primary action easier to spot.",
    });
    const refreshed = await store.loadProject(session.id);
    expect(refreshed.discussions).toContainEqual(saved.note);
    await expect(
      store.addDiscussionNote(session.id, {
        screenId: "today",
        body: "Stale note",
        expectedRevision: project.discussionRevision,
      }),
    ).rejects.toThrow("REVISION_CONFLICT");
  });

  it("rejects traversal and symlinks that escape the project", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const outside = join(tmpdir(), `protoraft-outside-${Date.now()}.png`);
    await writeFile(outside, pixelPng);
    await symlink(outside, join(root, "screens/today/escape.png"));

    await expect(
      store.readAsset(session.id, "../outside.png"),
    ).rejects.toThrow("Unsafe project path");
    await expect(
      store.readAsset(session.id, "screens/today/escape.png"),
    ).rejects.toThrow("Symlink escapes");
    await rm(outside, { force: true });
  });

  it("enforces queued, claimed, and completed wireframe states", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const queued = await store.createWireframeRequest(session.id, {
      title: "Search",
      purpose: "Find a saved story.",
      screenType: "Mobile screen",
    });

    expect(queued.status).toBe("queued");
    const claimed = await store.claimWireframeRequest(
      session.id,
      queued.id,
      "test-agent",
    );
    expect(claimed.status).toBe("claimed");
    expect(claimed.claimToken).toMatch(/^claim_[a-f0-9]{20}$/);
    await expect(
      store.claimWireframeRequest(session.id, queued.id, "second-agent"),
    ).rejects.toThrow("already claimed");

    const completed = await store.completeWireframeRequest(
      session.id,
      queued.id,
      {
        claimToken: claimed.claimToken!,
        screenId: "today",
        screenDefinitionPath: "screens/today/screen.json",
        wireframePath: "screens/today/wireframe.png",
      },
    );
    expect(completed.status).toBe("completed");
    expect(completed.claimToken).toBeUndefined();
  });

  it("lets exactly one of eight concurrent claims win and rejects the rest as busy", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const queued = await store.createWireframeRequest(session.id, {
      title: "Search",
      purpose: "Find a saved story.",
      screenType: "Mobile screen",
    });

    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        store.claimWireframeRequest(session.id, queued.id, `agent-${index}`),
      ),
    );
    const won = attempts.filter(
      (attempt) => attempt.status === "fulfilled",
    ) as PromiseFulfilledResult<{ claimToken?: string }>[];

    expect(won).toHaveLength(1);
    const onDisk = JSON.parse(
      await readFile(
        join(root, ".protoraft/requests", `${queued.id}.json`),
        "utf8",
      ),
    );
    expect(onDisk.status).toBe("claimed");
    expect(onDisk.claimToken).toBe(won[0].value.claimToken);
  });

  it("refuses to steal a pre-existing request lock and leaves it in place", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const queued = await store.createWireframeRequest(session.id, {
      title: "Search",
      purpose: "Find a saved story.",
      screenType: "Mobile screen",
    });
    const lockPath = join(root, ".protoraft/requests", `${queued.id}.lock`);
    await writeFile(lockPath, "held by an agent that is still running\n");

    await expect(
      store.claimWireframeRequest(session.id, queued.id, "agent-a"),
    ).rejects.toThrow("busy");
    expect((await stat(lockPath)).isFile()).toBe(true);
  });

  it("releases its own lock when the locked transition throws", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const queued = await store.createWireframeRequest(session.id, {
      title: "Search",
      purpose: "Find a saved story.",
      screenType: "Mobile screen",
    });
    const claimed = await store.claimWireframeRequest(
      session.id,
      queued.id,
      "agent-a",
    );
    const lockPath = join(root, ".protoraft/requests", `${queued.id}.lock`);

    await expect(
      store.completeWireframeRequest(session.id, queued.id, {
        claimToken: claimed.claimToken!,
        screenId: "today",
        screenDefinitionPath: "screens/today/missing.json",
        wireframePath: "screens/today/missing.png",
      }),
    ).rejects.toThrow();

    await expect(stat(lockPath)).rejects.toThrow(/ENOENT/);
    await expect(
      store.claimWireframeRequest(session.id, queued.id, "agent-b"),
    ).rejects.toThrow("already claimed");
  });

  it("rejects a wrong claim token and a second completion of the same request", async () => {
    const store = new ProjectStore();
    const session = await store.open(root);
    const queued = await store.createWireframeRequest(session.id, {
      title: "Search",
      purpose: "Find a saved story.",
      screenType: "Mobile screen",
    });
    const claimed = await store.claimWireframeRequest(
      session.id,
      queued.id,
      "agent-a",
    );
    const completion = {
      screenId: "today",
      screenDefinitionPath: "screens/today/screen.json",
      wireframePath: "screens/today/wireframe.png",
    };

    await expect(
      store.completeWireframeRequest(session.id, queued.id, {
        ...completion,
        claimToken: "claim_00000000000000000000",
      }),
    ).rejects.toThrow("claim token does not match");

    await expect(
      store.completeWireframeRequest(session.id, queued.id, {
        ...completion,
        claimToken: claimed.claimToken!,
      }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      store.completeWireframeRequest(session.id, queued.id, {
        ...completion,
        claimToken: claimed.claimToken!,
      }),
    ).rejects.toThrow("must be claimed before completion");
  });

  it("compares Git branches without checking either branch out", async () => {
    execFileSync("git", ["init", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.name", "ProtoRaft Test"], {
      cwd: root,
    });
    execFileSync("git", ["config", "user.email", "test@example.com"], {
      cwd: root,
    });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });
    execFileSync("git", ["checkout", "-b", "feature/listen"], { cwd: root });
    await writeFile(
      join(root, "documents/brief.md"),
      "# Fixture\n\nFeature branch.\n",
    );
    await writeFile(
      join(root, "design/components.json"),
      JSON.stringify({
        components: [
          {
            id: "story-card",
            name: "Story card",
            category: "Content",
            variants: ["Default"],
            states: ["Idle", "Selected"],
            platforms: ["web", "ios", "android"],
          },
        ],
      }),
    );
    execFileSync(
      "git",
      ["add", "documents/brief.md", "design/components.json"],
      { cwd: root },
    );
    execFileSync("git", ["commit", "-m", "change brief"], { cwd: root });
    execFileSync("git", ["checkout", "main"], { cwd: root });
    await writeFile(
      join(root, "documents/brief.md"),
      "# Fixture\n\nMain branch.\n",
    );
    execFileSync("git", ["add", "documents/brief.md"], { cwd: root });
    execFileSync("git", ["commit", "-m", "change brief on main"], {
      cwd: root,
    });

    const store = new ProjectStore();
    const session = await store.open(root);
    const comparison = await store.compareBranches(
      session.id,
      "main",
      "feature/listen",
      true,
    );

    expect(comparison.changedFiles).toContainEqual({
      path: "documents/brief.md",
      kind: "modified",
    });
    const project = await store.loadProject(session.id);
    const branchChange = project.branches
      .find((branch) => branch.name === "feature/listen")
      ?.changes.find((change) => change.path === "documents/brief.md");
    expect(comparison.possibleConflicts).toContain("documents/brief.md");
    expect(comparison.possibleConflicts).not.toContain(
      "design/components.json",
    );
    expect(branchChange?.kind).toBe("conflict");
    expect(
      project.branches
        .find((branch) => branch.name === "feature/listen")
        ?.changes.find((change) => change.path === "design/components.json")
        ?.kind,
    ).toBe("modified");
    expect(branchChange?.summary).toBe(
      "Both branches changed the fixture brief.",
    );
    expect(branchChange?.recommendation).toBe(
      "Keep the feature intent with the main wording.",
    );
    expect(branchChange?.baseContent).toContain("Main branch.");
    expect(branchChange?.compareContent).toContain("Feature branch.");
    expect(
      execFileSync("git", ["branch", "--show-current"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
    ).toBe("main");

    const featureCommit = execFileSync(
      "git",
      ["rev-parse", "feature/listen"],
      { cwd: root, encoding: "utf8" },
    ).trim();
    execFileSync("git", ["branch", "-D", "feature/listen"], { cwd: root });
    execFileSync(
      "git",
      ["update-ref", "refs/remotes/origin/feature/listen", featureCommit],
      { cwd: root },
    );

    const remoteOnlyProject = await store.loadProject(session.id);
    const remoteOnlyBranch = remoteOnlyProject.branches.find(
      (branch) => branch.name === "feature/listen",
    );
    expect(remoteOnlyBranch?.gitRef).toBe("origin/feature/listen");
    expect(
      remoteOnlyBranch?.changes.find(
        (change) => change.path === "documents/brief.md",
      )?.recommendation,
    ).toBe("Keep the feature intent with the main wording.");
  }, 10_000);

  it("keeps project-relative paths for a project in a subdirectory and excludes root and sibling changes", async () => {
    const repo = await mkdtemp(join(tmpdir(), "protoraft-subdir-"));
    try {
      const projectRoot = join(repo, "examples/morrow");
      await mkdir(projectRoot, { recursive: true });
      await createFixture(projectRoot);

      const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: repo });
      await writeFile(join(repo, "README.md"), "# workspace\n");
      await mkdir(join(repo, "examples/other"), { recursive: true });
      await writeFile(join(repo, "examples/other/note.md"), "# other project\n");
      git("init", "-b", "main");
      git("config", "user.name", "ProtoRaft Test");
      git("config", "user.email", "test@example.com");
      git("add", ".");
      git("commit", "-m", "fixture");

      git("checkout", "-b", "feature/subdir");
      await writeFile(
        join(projectRoot, "documents/brief.md"),
        "# Fixture\n\nSubdir change.\n",
      );
      await writeFile(join(repo, "README.md"), "# workspace changed\n");
      await writeFile(
        join(repo, "examples/other/note.md"),
        "# other project changed\n",
      );
      git("add", ".");
      git("commit", "-m", "mixed change");
      git("checkout", "main");

      const store = new ProjectStore();
      const session = await store.open(projectRoot);
      const comparison = await store.compareBranches(
        session.id,
        "main",
        "feature/subdir",
        false,
      );
      const paths = comparison.changedFiles.map((change) => change.path);

      expect(comparison.changedFiles).toEqual([
        { path: "documents/brief.md", kind: "modified" },
      ]);
      // repo-root change is excluded
      expect(paths).not.toContain("README.md");
      // sibling directory change is excluded
      expect(paths).not.toContain("examples/other/note.md");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }, 20_000);
});
