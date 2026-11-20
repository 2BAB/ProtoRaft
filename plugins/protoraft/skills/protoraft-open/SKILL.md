---
name: protoraft-open
description: Open or launch the ProtoRaft product-design workbench for an existing local project repository that already contains a ProtoRaft manifest.
---

# Open ProtoRaft

1. Resolve the absolute root of the user-selected Git repository.
2. Confirm it contains `protoraft.project.json`. The workbench does not
   initialize new projects. If the manifest is missing, explain that boundary
   and ask the user to select an existing ProtoRaft repository or the sample.
3. Call `open_protoraft_workbench` with that absolute path as `rootPath`.
4. After the workbench renders, let the user work in the UI. Do not start a
   localhost server for normal plugin use.

Use the Morrow fixture only when the user explicitly asks for the sample.
