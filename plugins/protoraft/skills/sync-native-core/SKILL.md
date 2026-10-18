---
name: sync-native-core
description: Map an approved ProtoRaft shared core into a confirmed Android or iOS repository. Use when the user asks to begin native implementation or synchronize approved design intent.
---

# Sync the native core

1. Confirm the target platform and repository before writing.
2. Read the target repository's `AGENTS.md`, architecture, theme, navigation,
   and existing components.
3. Read approved ProtoRaft tokens, component contracts, routes, states,
   accessibility intent, and visual references.
4. Map neutral contracts to the target platform:
   - Android: Compose theme, navigation, semantics, and reusable composables.
   - iOS: SwiftUI environment, navigation, accessibility, and reusable views.
5. Reuse target-native components before generating new ones.
6. Write only inside the confirmed target repository. Never copy web source,
   CSS, or framework-specific implementation into native code.
7. Hand the work to `plan-native-tasks`, then verify each completed slice with
   `verify-native-visuals` and `run-native-loop`.

Stop and ask when a product behavior is missing from ProtoRaft or conflicts
with an established target-app convention.
