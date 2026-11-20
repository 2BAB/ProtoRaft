---
name: publish-site
description: Publish or update a ProtoRaft project as a shareable read-only review site with Codex Sites. Use only when the user explicitly asks to publish or share a review site.
---

# Publish a ProtoRaft review site

1. Use the source directory returned by `prepare_protoraft_site`. If it has not been prepared, use the configured default branch. A branch review requires a source explicitly selected by the user.
2. Read `snapshot.json` in the source directory. Confirm its kind, branch, and commit match the request before deploying. For a branch review, confirm its base branch and commit as well. If the source has changed, return to the workbench to select the revision again.
3. Keep the exported review UI and `.openai/hosting.json`. Run the existing build. Use Codex Sites to create a project when the file has no `project_id`, or update the existing project for that source.
4. Choose access that matches the requested audience and follow the Sites approval flow. Return the deployed URL and its branch and commit.
