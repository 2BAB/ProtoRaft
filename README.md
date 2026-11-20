# ProtoRaft

ProtoRaft is an open-source Codex plugin for early product design. Wireframes,
notes, product specs, and design tokens live in Git alongside your code, so
reviews happen through regular branches and pull requests instead of a separate
tool.

To see the v1.1 workflow end to end, start with the bundled
[Morrow sample](examples/morrow). Feel free to fork this repo and swap in your
own Skills, project structure, or review steps.

## How it works

The plugin lives in `plugins/protoraft/` and ships as a Node stdio MCP server
paired with a single-file MCP App. There is no background daemon and no
database; Git-tracked files are the source of truth.

Inside Codex, the workbench handles reading, editing, and diffing those files,
while bundled Skills guide Codex through agent-driven steps: generating
wireframes with ImageGen, syncing tokens and layouts to Android or iOS repos,
setting up recurring freshness checks via scheduled tasks, and publishing
read-only review snapshots with Codex Sites.

ProtoRaft runs in three modes depending on what you're doing:

| Mode | Best for | What works |
| --- | --- | --- |
| Standalone preview | Local UI work against the bundled Morrow fixture | Navigation, responsive layout, wireframe maps, docs, and interactive HiFi |
| Installed Codex plugin | Working on a real local repo | MCP tools, Git file writes, agent handoffs, Skills, scheduled tasks, and Sites publishing |
| Published review site | Sharing with teammates | Read-only Production snapshot or a pinned branch comparison |

Edits made in the standalone preview stay in memory. Writing back to a
repository, triggering Codex workflows, scheduling checks, or publishing a site
all require the installed plugin.

## Prerequisites

- Node.js 22.12+
- pnpm 10
- Git
- A repository containing `protoraft.project.json` (use `examples/morrow` if you
  just want to try it out)

Host-backed features also need their matching Codex or local setup: ImageGen for
wireframe generation, Codex Sites for publishing, scheduled tasks enabled in the
Codex desktop app for recurring checks, and your usual Android/iOS toolchain for
native handoff.

## Run the standalone preview

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:4178` to browse the workbench with the bundled Morrow
project, or `http://127.0.0.1:4178/?preview=morrow` to jump straight into the
interactive mobile prototype.

## Verify the plugin package

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` type-checks the app, runs the MCP and project-store tests, builds
the single-file MCP App and bundled stdio server (along with third-party license
notices in `plugins/protoraft/dist`), and validates the plugin manifest, Skills,
and packaged files.

Once the build succeeds, run the browser regression test against the bundled
Morrow sample:

```bash
node plugins/protoraft/tests/workbench-smoke.mjs
```

The script clones this repository into a temporary directory and opens
`examples/morrow` with the built MCP App and stdio server. Keep `main` and
`feature/morrow-listen` available for the branch review. You can pass a PNG path
to use a generated image in the test. Set `PROTORAFT_TEST_CDP` to override the
default Chromium endpoint (`http://127.0.0.1:9333`). The script cleans up its
temporary clone and background tab, and records publishing handoffs locally.

## Install locally in Codex

Run `pnpm verify` first, then register and add the local plugin:

```bash
codex plugin marketplace add .
codex plugin add protoraft@protoraft-local
```

Start a new Codex task so the Skills and MCP tools load cleanly, then ask:

```text
Open ProtoRaft for this repository.
```

As long as the repo has a `protoraft.project.json`, Codex resolves its path,
calls `open_protoraft_workbench`, and opens the MCP App full screen, with no
local server to keep running.

### First installed smoke test

1. Open `examples/morrow` and check that the project loads from Git files.
2. Add a discussion note and edit a Markdown document, then save both.
3. Queue a wireframe and check that Codex receives the request ID and puts the
   generated result back onto the original canvas.
4. Compare `feature/morrow-listen` against `main`.
5. Ask to create a canvas-freshness scheduled task and confirm it shows up under
   **Scheduled** with the cadence and environment you picked.
6. Optionally verify the branch and commit, then publish a read-only snapshot
   with Codex Sites.
7. Try opening a repository without `protoraft.project.json` and confirm Codex
   explains that project initialization isn't supported yet instead of creating
   files on its own.

## Bundled Skills

- **Workbench:** `protoraft-open`, `generate-wireframe`,
  `check-canvas-freshness`, `review-collaboration`, `publish-site`
- **Web design:** `build-hifi`
- **Native handoff:** `sync-native-core`, `plan-native-tasks`,
  `verify-native-visuals`, `run-native-loop`

`sync-native-core` ties the other three native Skills together, so planning,
visual checks, and fix loops can each run with their own inputs and exit rules.

## Current limitations (v1.1)

- Project initialization isn't built yet. ProtoRaft expects an existing
  `protoraft.project.json` and is still centered around the Morrow sample.
- Wireframe maps, linked docs, Git diffs, and token tables read directly from
  the repo, while the interactive HiFi preview and rich component examples are
  still tailored to Morrow rather than arbitrary apps.
- You can edit existing Markdown docs and queue wireframes in the workbench,
  while adding new document declarations, tokens, or component contracts is
  still done by the agent.
- Agent handoffs, scheduled tasks, ImageGen, native sync, and Sites publishing
  require the installed Codex plugin and can't be tested in localhost preview
  alone.

## Repository layout

- `plugins/protoraft/`: Codex plugin, Skills, MCP server, and workbench UI
- [`examples/morrow/`](examples/morrow): Bundled Morrow sample and branch review
  scenario
- [Contributing](CONTRIBUTING.md): local setup, testing, and PR guidelines
- [Changelog](CHANGELOG.md) and [Security](SECURITY.md)

## License

ProtoRaft is licensed under the [Apache License 2.0](LICENSE). The bundled
Morrow sample is licensed under [MIT](examples/morrow/LICENSE).
