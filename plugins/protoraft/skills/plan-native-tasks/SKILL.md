---
name: plan-native-tasks
description: Split an approved ProtoRaft Android or iOS handoff into small, dependency-aware implementation tasks. Use when planning native work for agents or teammates.
---

# Plan native tasks

1. Inventory shared tokens, components, routes, screens, and required states.
2. Create shared-foundation tasks before screen tasks that depend on them.
3. Keep each task independently reviewable and name its target module, inputs,
   expected states, and verification evidence.
4. Assign ownership by platform and module. Never assign the same shared
   component to multiple workers.
5. Mark product decisions as blockers instead of letting agents invent them.
6. Sequence integration and visual verification after implementation tasks.

Prefer one screen or one shared component per task. Avoid plans made of generic
phases such as "build UI" or "finish polish."
