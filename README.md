# ProtoRaft

ProtoRaft is a simple, versatile, open-source Codex plugin for product design.
It keeps wireframes, discussion notes, and product specs together in Git so
teammates can see what changed, why it changed, and what to build next.

The [Morrow sample](examples/morrow) shows the v1.1 workflow.

## Work with Codex

The workbench runs as an MCP App in Codex, where bundled Skills guide the agent
through design, review, and handoff. ProtoRaft uses ImageGen for wireframes and
can use Codex scheduled tasks for recurring checks and Codex Sites to share
read-only snapshots.

## Build on ProtoRaft

You're welcome to fork this repository and build on the workbench. Add your own
Skills, project conventions, or review steps to fit the way your team works.

## Runtime surfaces

| Surface | Purpose | Available capabilities |
| --- | --- | --- |
| Standalone preview | Fast UI development with the fictional Morrow fixture | Navigation, responsive layout, maps, documents, and interactive HiFi |
| Installed Codex plugin | Edit and review a local project | Repository-backed MCP tools, file writes, agent messages, Skills, scheduled-task requests, and Sites handoff |
| Published review site | Shareable review | Read-only Production snapshot or a pinned branch comparison |

Standalone preview notes and edits are temporary. Use the installed plugin to
write to a repository, send requests to Codex, schedule checks, or publish a site.

## Prerequisites

- Node.js 22.12 or newer
- pnpm 10
- Git
- An existing repository containing `protoraft.project.json`

Open `examples/morrow` for a project with an existing manifest and a sample review
branch.

Image generation requires ImageGen in the active Codex environment. Publishing
requires Codex Sites. Native handoff requires a confirmed Android or iOS target
repository and its normal local toolchain. Scheduled reviews require scheduled
tasks to be enabled in the Codex desktop app.

## Run the standalone preview

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:4178`. The standalone preview uses the bundled fictional
Morrow project. Use `http://127.0.0.1:4178/?preview=morrow` for the interactive
mobile prototype.

## Verify the plugin package

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` type-checks the app, runs the MCP and project-store tests, creates
the single-file MCP App and bundled stdio server, then validates the plugin
manifest, Skill metadata, and packaged files. The build generates third-party
license notices in `plugins/protoraft/dist`.

After building, run the MCP App browser regression against a disposable clone of
a standalone checkout of the Morrow sample. The script starts its own local host, uses a background tab
on the configured Chromium CDP endpoint, and removes the clone and tab when it
finishes. An optional final argument supplies a generated PNG instead of the
sample image.

```bash
node plugins/protoraft/tests/workbench-smoke.mjs /path/to/ProtoRaft-Sample
```

Set `PROTORAFT_TEST_CDP` to override the default `http://127.0.0.1:9333`.
The test exercises the real bundle and stdio MCP server. It records Agent handoffs
locally so it can test publishing without deploying a site.

## Install locally in Codex

Do this only after `pnpm verify` passes:

```bash
codex plugin marketplace add .
codex plugin add protoraft@protoraft-local
```

Then start a new Codex task so the installed Skills and MCP tools load from a
clean context. Ask Codex:

```text
Open ProtoRaft for this repository.
```

The selected repository must contain `protoraft.project.json`. The agent
resolves its absolute path, calls `open_protoraft_workbench`, and opens the
full-screen MCP App. No persistent localhost service is required.

### First installed smoke test

1. Open `ProtoRaft-Sample` and confirm the Morrow project loads from Git files.
2. Add one discussion note and save one Markdown document.
3. Queue one atomic wireframe and confirm Codex receives the request ID and the resulting wireframe opens in the original canvas.
4. Compare the sample branch with `main`.
5. Create a canvas-freshness scheduled task and confirm it appears in
   **Scheduled** with the selected cadence and execution environment.
6. Optionally verify the branch and commit, then publish a read-only snapshot with Codex Sites.
7. Ask to open a repository without `protoraft.project.json` and confirm the
   agent explains the v1.1 boundary without inventing or writing project files.

## How the plugin works

The installable package lives in `plugins/protoraft/`. Its runtime is a bundled
Node stdio MCP server plus a single-file MCP App. Git-readable project files are
the source of truth; the workbench does not add a database.

Wireframe generation and native sync are agent-driven in v1.1. The workbench
queues durable requests and stores reviewable artifacts, while Codex performs
ImageGen or target-repository implementation after reading the bundled Skills.

The scheduled-review control also depends on the Codex host. Inside the
installed plugin it sends a task-creation request into the Codex conversation;
the Codex agent creates or updates the scheduled task. In standalone preview it
is unavailable.

## Bundled Skills

- **Workbench:** `protoraft-open`, `generate-wireframe`,
  `check-canvas-freshness`, `review-collaboration`, and `publish-site`
- **Web design:** `build-hifi`
- **Native handoff:** `sync-native-core`, `plan-native-tasks`,
  `verify-native-visuals`, and `run-native-loop`

The native Skills stay separate because planning, implementation, visual
verification, and bounded correction have different inputs and stopping
conditions. `sync-native-core` coordinates the other three instead of
duplicating their instructions.

## Current v1.1 boundaries

- The first installed workflow is centered on the Morrow sample. Project
  initialization is not implemented yet.
- Wireframe maps, linked documents, Git review, and token tables are
  repository-backed. The interactive HiFi renderer and rich component examples
  are still sample-specific Morrow views, not a generic runtime for
  arbitrary products.
- The workbench edits existing declared Markdown documents and queues
  wireframes. Creating new document declarations, design tokens, or component
  contracts is still agent work rather than a complete visual authoring flow.
- Agent messages, scheduled-task creation, ImageGen, native sync, and Sites
  publishing require installed-plugin testing; localhost cannot validate those
  host integrations.

## Repository layout

- `plugins/protoraft/`: Codex plugin, Skills, MCP server, and workbench UI.
- [`examples/morrow/`](examples/morrow): Morrow sample source, wireframes, and a
  Git branch review scenario.
- [Contributing](CONTRIBUTING.md): local setup, testing, and contributions.
- [Changelog](CHANGELOG.md) and [security reporting](SECURITY.md).

## License

ProtoRaft is licensed under the [Apache License 2.0](LICENSE). The bundled
Morrow sample is distributed under its [MIT license](examples/morrow/LICENSE).
