---
name: publish-site
description: Publish or update the current ProtoRaft project as a shareable, read-only Production review site with Codex Sites. Use only when the user explicitly asks to publish or share a review site.
---

# Publish a ProtoRaft review site

1. Use the source directory returned by `prepare_protoraft_site`. If no export
   was prepared, call that tool for the active project first.
2. Confirm the export reports `displayMode: prod` and the project's configured
   default branch. Never publish the editable Local workbench or another branch.
3. Use Codex Sites for the prepared directory:
   - preserve its `.openai/hosting.json`;
   - run the existing build;
   - create a Sites project only when no `project_id` exists;
   - save and deploy the exact built source.
   The directory is stable for this local repository, so later publishes must
   update the existing Sites project rather than create a second site.
4. Choose an access level suitable for the user's requested review audience and
   follow any Sites approval requirement before a shared or public deployment.
5. Return the deployed URL. Do not copy project artifacts into a second UI or
   reintroduce editing, Git comparison, repository status, or plugin settings.
