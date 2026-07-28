# ProtoRaft Sample: Morrow v0.1

This is the official sample repository for ProtoRaft. Morrow is a fictional
daily magazine used to show a realistic product workflow across wireframes,
product documents, design-system contracts, screen previews, and Git
collaboration.

## Open in ProtoRaft

Clone the repository, keep both demo branches available locally, and ask Codex
to open ProtoRaft for this folder:

```bash
git clone git@github.com:2BAB/ProtoRaft-Sample.git
cd ProtoRaft-Sample
git branch --track feature/morrow-listen origin/feature/morrow-listen
node scripts/validate-sample.mjs
```

Then ask:

> Open this repository with ProtoRaft and show me the workbench.

ProtoRaft reads `protoraft.project.json`; no database or import step is needed.

## What to review

The five connected screens form one journey:

`Today -> Story -> Focus reading / Now Playing / Saved`

- **Wireframes** shows the five atomic grayscale screens as a map or list.
- **Documents** links the product brief and interaction spec back to each
  screen.
- **Design System** shows reviewable tokens and component contracts.
- **Screens** previews the five routes at a mobile viewport.
- **Collaboration** compares `main` with `feature/morrow-listen`.

The review branch is intentional. It proposes a different product decision
about what happens after the full audio player closes, and updates the Listen
screen definition, its wireframe, and the audio-player contract. ProtoRaft
should report four changed artifacts and one decision that needs review.

Use **Ask Codex to resolve** to request a proposal. The expected workflow is
review first: Codex should explain the product impact and wait before writing,
merging, committing, or pushing.

## Repository map

- `protoraft.project.json`: project manifest.
- `flows/`: screen relationships and map positions.
- `screens/`: one definition and one wireframe per screen.
- `documents/`: product brief, interaction spec, and screen-linked notes.
- `design/`: DTCG-shaped tokens and component contracts.
- `hifi/`: preview routes and visual guidance.
- `collaboration/`: human-readable review intent for known branch scenarios.
- `prompts/`: the image-generation recipe.
- `scripts/validate-sample.mjs`: structural and Git-scenario validation.

## Intentional review branch

The unmerged review branch is part of the sample, not abandoned work.
Do not merge `feature/morrow-listen` into `main` in this official repository.
Use a disposable clone or worktree when testing an automated resolution.
