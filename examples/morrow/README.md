# Morrow

Morrow is a fictional daily magazine and a sample project for the ProtoRaft
Codex plugin. Its source includes wireframes, screen definitions, product
documents, design tokens, and the contracts for five preview routes.

## Open in ProtoRaft

Open this folder in Codex with the ProtoRaft plugin installed and ask:

> Open this repository with ProtoRaft and show me the workbench.

The workbench reads `protoraft.project.json`. If you are using the
`examples/morrow` copy inside the ProtoRaft workspace, point Codex at that
directory.

## Review the player change

The `main` and `feature/morrow-listen` branches are the two sides of a product
review. Open **Review**, select the Listen wireframe or the interaction spec,
then compare the versions side by side. The feature branch proposes keeping
audio playing after the full player closes. The scenario records the pending
decision about where the mini player should appear.

## Sample source

| Path | Contents |
| --- | --- |
| `flows/` and `screens/` | Screen definitions, navigation, and wireframes |
| `documents/` | Product brief, interaction spec, and discussion notes |
| `design/` | Design tokens and component contracts |
| `hifi/` | Preview routes and visual guidance |
| `collaboration/` | Branch review scenario |
| `prompts/` | Wireframe generation notes |

Validate the files and branch scenario with Node.js 22.12 or newer:

```sh
node scripts/validate-sample.mjs
```

See [Contributing](CONTRIBUTING.md). The sample source is licensed under the
[MIT License](LICENSE).
