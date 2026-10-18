---
name: verify-native-visuals
description: Visually compare Android or iOS implementation captures with approved ProtoRaft references and report concrete deviations. Use for native visual QA and correction evidence.
---

# Verify native visuals

1. Build and open the exact target screen and state.
2. Capture the target viewport with the platform's normal screenshot tooling.
3. Compare hierarchy, spacing, typography, color, component state, content
   fit, safe areas, and navigation behavior with the approved reference.
4. Report concrete deviations in priority order. Do not hide differences behind
   a single similarity score.
5. Fix target code only when the intended behavior is already unambiguous.
6. Rebuild and recapture the affected state after every correction.

Verify phone and tablet layouts separately when their interaction patterns
differ. Treat clipped text, overlap, broken dynamic type, and inaccessible
states as failures.
