---
name: run-native-loop
description: Run a bounded build, capture, compare, and correction loop for one approved ProtoRaft Android or iOS implementation slice. Use after a native task is ready to implement.
---

# Run the native implementation loop

For one screen, state, or shared component:

1. Inspect the target code and approved ProtoRaft references.
2. Implement the smallest coherent slice.
3. Run the narrowest relevant build and tests.
4. Open the target state and capture visual evidence.
5. Use `verify-native-visuals` to identify specific deviations.
6. Correct only verified deviations, then rebuild and recapture.
7. Stop after three correction passes and report any remaining product or
   platform decision instead of looping indefinitely.

Do not move to another screen while the current slice has build failures,
unverified navigation, clipped content, or unresolved product intent.
