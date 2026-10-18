# ProtoRaft

ProtoRaft is an open-source Codex plugin for turning early product thinking into
traceable wireflows, lightweight product documents, design tokens, component
specifications, and interactive HiFi previews.

The v0.1 workbench is designed for product and marketing teams. It keeps project
artifacts in a user-selected Git repository so teammates can review changes
through familiar branches and pull requests.

> [!WARNING]
> ProtoRaft v0.1 is a work in progress and is not ready for production use.
> Current development is focused on refining the Morrow sample and validating
> the complete Codex plugin workflow.

## Product philosophy

ProtoRaft is deliberately small. It should shorten a product conversation, not
create another process that needs managing.

### One minute: get something worth discussing

Wireframe turns a new requirement into one atomic prototype in about a minute.
The result opens as a large wireframe, stays separate from HiFi, and keeps short
screen-linked discussion notes beside it. It is useful immediately before a
meeting, during a meeting, or when thinking through an idea alone.

### Five minutes: establish the shared core

Design System turns approved wireframes into web-based design tokens, component
contracts, routes, states, and interactive HiFi previews. `Sync core` hands the
same neutral intent to Android and iOS repositories. Bundled Skills help agents
convert it into native patterns, split the work, verify captures, and run a
bounded build-and-correct loop.

### Review only what changed

Collaboration compares Git branches and puts the changed artifact first. Color
is reserved for the small amount of information that needs attention. ProtoRaft
does not add live cursors, a second task tracker, or a database beside Git.

Our working rules:

- Put one primary action and one primary artifact on each page.
- Keep explanations next to the work and reveal secondary context on demand.
- Prefer readable type and whitespace over fitting everything above the fold.
- Store durable artifacts in Git-readable files.
- Do not add a feature unless it makes alignment faster or clearer.

## Runtime surfaces

ProtoRaft has three deliberately different surfaces:

| Surface | Purpose | Available capabilities |
| --- | --- | --- |
| Standalone preview | Fast UI development with the fictional Morrow fixture | Navigation, responsive layout, maps, documents, and interactive HiFi |
| Installed Codex plugin | The real local product workflow | Repository-backed MCP tools, file writes, agent messages, Skills, scheduled-task requests, and Sites handoff |
| Published Production site | Shareable review | Read-only default-branch project snapshot |

The standalone preview cannot call MCP tools, send messages to Codex, create a
scheduled task, or publish a Site. Controls that require the Codex host must say
so instead of simulating success.

## Prerequisites

- Node.js 22.12 or newer
- pnpm 10
- Git
- An existing repository containing `protoraft.project.json`

For the first installed-plugin test, use
[ProtoRaft-Sample](https://github.com/2BAB/ProtoRaft-Sample). ProtoRaft v0.1
does not initialize an arbitrary repository yet.

Image generation requires ImageGen in the active Codex environment. Publishing
requires Codex Sites. Native handoff requires a confirmed Android or iOS target
repository and its normal local toolchain. Scheduled reviews require scheduled
tasks to be enabled in the Codex desktop app.

## Run the standalone preview

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4178`. The standalone preview uses the bundled fictional
Morrow project. Use `http://127.0.0.1:4178/?preview=morrow` for the interactive
mobile prototype.

## Verify the plugin package

```bash
pnpm install
pnpm verify
```

`pnpm verify` type-checks the app, runs the MCP and project-store tests, creates
the single-file MCP App and bundled stdio server, then validates the plugin
manifest and every Skill. It requires a local Codex installation because the
official plugin and Skill validators ship with Codex.

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
3. Queue one atomic wireframe and confirm Codex receives the generation request.
4. Compare the sample branch with `main`.
5. Create a canvas-freshness scheduled task and confirm it appears in
   **Scheduled** with the selected cadence and execution environment.
6. Optionally prepare and publish the read-only Production view with Codex
   Sites.
7. Ask to open a repository without `protoraft.project.json` and confirm the
   agent explains the v0.1 boundary without inventing or writing project files.

## How the plugin works

The installable package lives in `plugins/protoraft/`. Its runtime is a bundled
Node stdio MCP server plus a single-file MCP App. Git-readable project files are
the source of truth; the workbench does not add a database.

Wireframe generation and native sync are agent-driven in v0.1. The workbench
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

## Current v0.1 boundaries

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
- [ProtoRaft-Sample](https://github.com/2BAB/ProtoRaft-Sample): Official Morrow
  sample with five connected screens and a reviewable Git branch scenario.
- `CONTRIBUTING.md`: contribution, licensing, and verification rules.

ProtoRaft v0.1 supports asynchronous Git collaboration. It does not claim
Figma-style live cursors or simultaneous editing. A public-directory release
will also need final listing artwork, marketplace copy, and a recorded
cross-surface evaluation pass; those are not required for the first local
installation.
