import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const plugin = resolve(root, "plugins/protoraft");
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const release = await json(resolve(root, "package.json"));
const pkg = await json(resolve(plugin, "package.json"));
const manifest = await json(resolve(plugin, ".codex-plugin/plugin.json"));
const marketplace = await json(resolve(root, ".agents/plugins/marketplace.json"));
const listing = marketplace.plugins?.find(({ name }) => name === manifest.name);

assert.equal(manifest.name, "protoraft", "Plugin name");
assert.match(manifest.version, /^\d+\.\d+\.\d+$/, "Plugin version");
assert.equal(manifest.version, pkg.version, "Plugin and package versions");
assert.equal(pkg.version, release.version, "Plugin and workspace versions");
assert.equal(manifest.license, pkg.license, "Plugin and package licenses");
assert.equal(pkg.license, release.license, "Plugin and workspace licenses");
assert.ok(manifest.description?.trim(), "Plugin description is required");
assert.ok(manifest.interface?.displayName?.trim(), "Plugin display name is required");
assert.equal(listing?.source?.source, "local", "Local marketplace source");
assert.equal(resolve(root, listing.source.path), plugin, "Marketplace plugin directory");
assert.equal(manifest.skills, "./skills/", "Bundled Skills directory");
assert.equal(manifest.mcpServers, "./.mcp.json", "Bundled MCP configuration");

const config = await json(resolve(plugin, manifest.mcpServers));
const server = config.mcpServers?.protoraft;
assert.equal(server?.command, "node", "MCP server command");
assert.equal(server.cwd, ".", "MCP server working directory");
assert.deepEqual(server.args, ["./dist/server.mjs", "--stdio"], "MCP server arguments");

const skills = resolve(plugin, manifest.skills);
const entries = (await readdir(skills, { withFileTypes: true }))
  .filter((item) => item.isDirectory());
assert.ok(entries.length > 0, "At least one bundled Skill is required");
for (const { name } of entries) {
  assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Skill directory name");
  const skill = await readFile(resolve(skills, name, "SKILL.md"), "utf8");
  const frontmatter = /^---\r?\n([\s\S]+?)\r?\n---(?:\r?\n|$)/.exec(skill)?.[1];
  assert.ok(frontmatter, `${name} needs YAML frontmatter`);
  assert.equal(/^name:\s*([a-z0-9-]+)\s*$/m.exec(frontmatter)?.[1], name, `${name} metadata must match its directory`);
  assert.match(frontmatter, /^description:[ \t]+\S.+$/m, `${name} needs a description`);
}

for (const file of ["LICENSE", "NOTICE", "dist/index.html", server.args[0],
  "dist/THIRD_PARTY_UI.md", "dist/THIRD_PARTY_SERVER.md"]) {
  const artifact = await stat(resolve(plugin, file));
  assert.ok(artifact.isFile() && artifact.size > 0, `Missing packaged file: ${file}`);
}

const html = await readFile(resolve(plugin, "dist/index.html"), "utf8");
const ui = /<script\b[^>]*\btype="module"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
assert.ok(ui?.trim(), "The MCP App must include its inline UI module");
assert.ok(html.includes('id="protoraft-third-party-licenses"'), "The inline UI needs its license notices");
const syntax = spawnSync(process.execPath, ["--check", "--input-type=module", "-"], {
  input: ui, encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
});
const syntaxError = syntax.stderr?.split("\n").find((line) => line.startsWith("SyntaxError:"));
assert.equal(syntax.status, 0, syntaxError ?? "The inline UI module must be valid JavaScript");

console.log(`ProtoRaft ${manifest.version} package and ${entries.length} bundled Skills verified.`);
