---
name: generate-wireframe
description: Claim and complete one queued ProtoRaft wireframe request with a single atomic product screen. Use only after the workbench has created a generation request.
---

# Generate an atomic wireframe

1. Call `claim_wireframe_request` and retain its `claimToken`.
2. Read the request's purpose, required elements, source screen, and constraints.
3. Use ImageGen to create exactly one standalone screen or state in one
   generation pass. Do not make variants unless the user explicitly asks.
4. Reject any result that contains multiple screens, a storyboard, annotations,
   flow arrows, perspective mockups, or decorative product-shot styling.
5. Write a screen definition and its generated image inside the project.
6. Call `complete_wireframe_request` with the same request ID and claim token,
   plus `screenId`, `screenDefinitionPath`, and `wireframePath`.
7. If the claim is stale, do not overwrite the newer result.
8. Return the completed screen immediately so the team can discuss it; refine
   only after the first review note or an explicit follow-up request.

Default visual direction:

- medium-fidelity grayscale product wireframe
- one portrait mobile screen
- white background, black and neutral gray only
- clear hierarchy and realistic platform spacing
- simple gray image placeholders
- no gradients, shadows, textures, or brand imitation
