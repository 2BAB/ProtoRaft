# ProtoRaft Sample Agent Notes

## Purpose

Morrow is the official ProtoRaft sample. Keep every artifact useful to product
and marketing reviewers who may not read application source code.

## Project contract

- Read `protoraft.project.json` before editing.
- Keep wireframes atomic: one PNG represents one screen or state.
- Keep product decisions in Markdown and structural contracts in JSON.
- Preserve links among flow nodes, screen definitions, documents, and routes.
- Run `node scripts/validate-sample.mjs` after changing sample artifacts.

## Intentional collaboration scenario

`feature/morrow-listen` intentionally proposes a different audio-player
dismissal policy from `main`. The scenario definition and expected product
resolution live in `collaboration/review-scenarios.json`.

- Treat the branch difference as a product decision, not only a text diff.
- Inspect both branch versions and the related screen and component changes.
- Explain impact in plain language before proposing file edits.
- Do not merge, commit, or push a resolution unless the user explicitly asks.
- For automated evaluation, work in a disposable clone or worktree and leave
  the official branches unchanged.

## Sample content

Keep Morrow fictional and internally consistent. New names, copy, images, and
design decisions should belong to the sample's own product story.
