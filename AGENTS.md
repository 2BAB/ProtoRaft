# ProtoRaft Agent Notes

## Product intent

ProtoRaft helps product and marketing teams align product structure, interaction
flows, product documentation, design systems, and implementation handoff.

## Project integrity

- Keep implementation decisions, schemas, documentation, and sample content
  self-contained in this repository.
- Only add dependencies and assets that can be redistributed under their
  documented licenses.
- Do not commit private source material, local reference paths, third-party
  product marks, or unlicensed content.
- Keep Morrow fictional and internally consistent.

## UX

- Follow the latest OpenAI product style for the workbench, including its
  colors, typography, spacing, and interaction patterns.
- Use a left sidebar for primary product areas.
- Prefer dense, work-focused layouts over marketing cards.
- Keep every generated wireframe atomic: one image represents one screen or state.

## Runtime

- The plugin UI is an MCP App, not a localhost page in normal use.
- The bundled MCP server uses stdio and must not require a permanent HTTP port.
- HiFi browser preview may use a temporary localhost Vite server.
- Git files are canonical. Do not add a runtime database in v0.1.

## Verification

Before a release or commit, run:

```bash
pnpm verify
```

Also inspect the standalone workbench and Morrow preview at desktop and mobile
viewports. Before the first install or any MCP/App bridge change, repeat the
installed-plugin smoke test in `README.md` from a new Codex task.
