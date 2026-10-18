---
name: check-canvas-freshness
description: Check a ProtoRaft repository for stale or changed canvas artifacts and write its local Review indicator status. Use for explicit drift checks and scheduled freshness-review runs.
---

# Check canvas freshness

1. Read `protoraft.project.json`, its flow, screen definitions, linked
   documents, design tokens, and component contracts.
2. Inspect the working tree and fetch configured remotes when network access is
   available. Never merge, rebase, checkout another branch, commit, or push.
3. Mark an artifact for review when:
   - an upstream or working-tree change touches a manifest-declared artifact;
   - a screen definition, linked document, flow, token file, or component
     contract has a newer Git commit than that screen's wireframe;
   - a declared file is missing or cannot be parsed.
4. Resolve the repository metadata directory with
   `git rev-parse --path-format=absolute --git-common-dir`. Create its
   `protoraft` child directory when needed.
5. Atomically write `protoraft/review-status.json` inside that Git common
   directory:

```json
{
  "schemaVersion": "0.1",
  "state": "updates-available",
  "checkedAt": "2026-07-28T09:00:00+08:00",
  "summary": "3 artifacts may need review.",
  "changedArtifacts": 3
}
```

Use `current` only after every declared artifact was checked and no update was
found. Use `error` when the check could not complete, with a short actionable
summary. Never write generated status into the repository working tree.
