# Contributing

ProtoRaft welcomes focused changes that keep the plugin and its project format
easy to inspect.

## Code and dependencies

- Follow the existing TypeScript, MCP, and Skill conventions.
- Keep behavior covered by the smallest useful test.
- Add third-party packages only when their license permits redistribution and
  the dependency removes meaningful implementation risk.
- Never commit secrets, private files, machine-specific paths, or generated
  dependency directories.
- Never open or print a real `.env` file. Document configuration names and safe
  placeholders in `.env.example` when environment variables are needed.

## Documentation and assets

- Write product copy and examples for ProtoRaft and its fictional Morrow sample.
- Add only assets you created or have explicit permission to redistribute.
- Record required attribution in the relevant license file when a dependency or
  asset license calls for it.
- Keep sample artifacts linked through `protoraft.project.json` and run their
  validator after changes.
- Use fictional data in fixtures, generated assets, and screenshots. Keep
  personal data and private reference material out of public artifacts.
- Keep third-party notices and required license text with redistributed code,
  icons, and generated artifacts that contain upstream material.
- Label mocked or simplified behavior, document limitations, and claim only
  capabilities demonstrated by the corresponding verification evidence.

## Verification

Run `pnpm verify` before proposing a release or repository checkpoint.
