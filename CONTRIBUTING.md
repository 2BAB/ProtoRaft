# Contributing

ProtoRaft welcomes focused changes to its workbench, project format, and
bundled Skills.

## Set up and test

Use Node.js 22.12 or newer and the pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm verify
node examples/morrow/scripts/validate-sample.mjs
```

Run `pnpm dev` for the standalone workbench. The
[browser regression test](README.md#verify-the-plugin-package) exercises the
built MCP App. Use `examples/morrow` when testing a repository-backed workflow.

## Submit a change

- Describe the workflow and expected behavior in your issue or pull request.
- Keep application contracts and sample artifacts linked through
  `protoraft.project.json`.
- Cover behavior changes with a focused test and include screenshots for
  changes to the workbench where they help.
- Use material you have permission to redistribute and include its
  required attribution.
- Use fictional data or a minimal sample in logs and reproductions.

See the [security policy](SECURITY.md) for vulnerability reports.
