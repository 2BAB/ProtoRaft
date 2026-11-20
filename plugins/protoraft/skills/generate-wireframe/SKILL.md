---
name: generate-wireframe
description: Claim and complete one queued ProtoRaft wireframe request with a single atomic product screen. Use only after the workbench has created a generation request.
---

# Generate an atomic wireframe

1. Call `claim_wireframe_request` with the project ID and request ID supplied by the workbench. If an ID is missing, use `list_wireframe_requests` when the project ID is known. Ask for the intended request when multiple entries match.
2. Use the claimed purpose, format, and source screen to generate one wireframe with ImageGen. Read the source screen's definition from the project's declared flow when one was selected.
3. Write the PNG and screen definition under the returned `rootPath` at the returned output paths. Those paths are unique to this attempt. Use the returned screen ID, a distinct route, and `wireframe: "wireframe.png"`. Record the user-facing title, purpose, and supported interactions in the definition.
4. Call `complete_wireframe_request` with the same IDs, claim token, and output paths. The tool validates the files and adds the screen to the canvas. If generation or completion fails, call `fail_wireframe_request` with a short explanation so the user can retry from the workbench. A stale claim leaves later attempts in control.

Use a medium-fidelity grayscale layout in the requested format. Create one screen or overlay with a clear hierarchy and simple placeholders. Keep storyboards, device frames, annotations, and alternative layouts out of the image.
