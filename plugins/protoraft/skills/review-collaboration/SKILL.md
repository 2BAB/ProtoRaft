---
name: review-collaboration
description: Compare ProtoRaft artifacts across two Git branches, explain product impact, and propose a human-readable conflict resolution. Use for branch review or collaboration conflicts.
---

# Review branch differences

1. Call `compare_protoraft_branches` with two explicit refs.
2. Group changes by artifact type: documents, flows, screens, images, tokens,
   components, and HiFi.
3. Explain product impact in plain language before showing raw diff details.
4. Treat binary images as non-mergeable. Show both versions and ask which
   intent should win.
5. Propose a resolution, but do not write, commit, merge, or push until the
   user confirms.
