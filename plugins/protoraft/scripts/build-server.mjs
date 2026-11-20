import { build } from "esbuild";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const { metafile } = await build({
  absWorkingDir: root,
  entryPoints: ["mcp/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/server.mjs",
  metafile: true,
  legalComments: "eof",
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});

const packageDirectories = new Set();
for (const { inputs } of Object.values(metafile.outputs)) {
  for (const [input, { bytesInOutput }] of Object.entries(inputs)) {
    if (!bytesInOutput) continue;
    const normalized = input.replaceAll("\\", "/");
    const marker = "/node_modules/";
    const absolute = resolve(root, normalized).replaceAll("\\", "/");
    const last = absolute.lastIndexOf(marker);
    if (last === -1) continue;
    const directory = absolute.slice(0, last + marker.length);
    const parts = absolute.slice(directory.length).split("/");
    const name = parts.slice(0, parts[0].startsWith("@") ? 2 : 1).join("/");
    packageDirectories.add(directory + name);
  }
}

const licenses = [];
for (const directory of packageDirectories) {
  const pkg = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
  const notices = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^(?:licen[cs]e|copying|copyright|notice)(?:[._-].*)?$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const title = `## ${pkg.name} ${pkg.version} (${pkg.license ?? "See upstream license"})`;
  const files = await Promise.all(notices.map(async (name) =>
    `### ${name}\n\n${(await readFile(resolve(directory, name), "utf8")).trimEnd()}`));
  const upstream = `Upstream: https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
  licenses.push([title, upstream, ...files].join("\n\n"));
}

await writeFile(
  resolve(root, "dist/THIRD_PARTY_SERVER.md"),
  ["# MCP server bundled dependencies", ...licenses.sort()].join("\n\n") + "\n",
);
