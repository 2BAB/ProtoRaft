---
name: build-hifi
description: Build, refresh, or verify a connected browser HiFi preview from approved ProtoRaft screens, tokens, and component specs. Use for web previews, not native Android or iOS implementation.
---

# Build a HiFi preview

1. Read the project's approved screen definitions, interaction edges, tokens,
   and component specifications.
2. Follow the target repository's `AGENTS.md` and existing framework.
3. Reuse the target project's components where available.
4. Preserve every documented route, state, and back-navigation relationship.
5. Start the smallest suitable local preview server.
6. Open the result in the Codex in-app browser and verify the relevant routes at
   desktop and phone viewports.

Do not infer native Android or iOS implementation details from a web screenshot.
Use the neutral handoff pack for platform implementation.
