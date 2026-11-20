import assert from "node:assert/strict";
import { readFile, readdir, unlink, writeFile } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const template = new URL("index.html", dist);
const html = await readFile(template, "utf8");
const notices = await readFile(new URL("THIRD_PARTY_UI.md", dist), "utf8");
assert.ok(notices.includes("react"), "The bundled UI needs third-party license notices");
const bodyEnd = html.lastIndexOf("</body>");
assert.ok(bodyEnd !== -1, "The single-file preview needs a closing body tag");

const text = notices.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const contents = `<template id="protoraft-third-party-licenses"><pre>${text}</pre></template>\n`;
await writeFile(template, html.slice(0, bodyEnd) + contents + html.slice(bodyEnd));

for (const file of await readdir(dist)) {
  if (/^(?:index|style)-[A-Za-z0-9_-]+\.(?:js|css)$/.test(file)) {
    assert.ok(!(html.includes(`src="/${file}"`) || html.includes(`href="/${file}"`)), `UI bundle was not inlined: ${file}`);
    await unlink(new URL(file, dist));
  }
}
