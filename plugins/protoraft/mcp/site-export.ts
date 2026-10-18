import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ProjectStore } from "./project-store";

const execFileAsync = promisify(execFile);

interface PrepareSiteExportOptions {
  store: Pick<
    ProjectStore,
    "loadProductionProject" | "siteSourceDirectory"
  >;
  projectId: string;
  uiTemplatePath: string;
}

function scriptJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function packageName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 54) || "protoraft-project"
  );
}

const buildScript = `import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const html = await readFile(join(root, "index.html"), "utf8");
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "server"), { recursive: true });
await mkdir(join(dist, "static"), { recursive: true });
const worker = [
  "const html = " + JSON.stringify(html) + ";",
  "export default {",
  "  async fetch(request) {",
  "    if (request.method !== 'GET' && request.method !== 'HEAD') {",
  "      return new Response('Method not allowed', { status: 405 });",
  "    }",
  "    return new Response(request.method === 'HEAD' ? null : html, {",
  "      headers: {",
  "        'content-type': 'text/html; charset=utf-8',",
  "        'cache-control': 'public, max-age=300'",
  "      }",
  "    });",
  "  }",
  "};",
  "",
].join("\\n");
await writeFile(join(dist, "server/index.js"), worker);
await writeFile(join(dist, "static/index.html"), html);
`;

export async function prepareSiteExport({
  store,
  projectId,
  uiTemplatePath,
}: PrepareSiteExportOptions) {
  const project = await store.loadProductionProject(projectId);
  const template = await readFile(uiTemplatePath, "utf8");
  if (!template.includes("<head>")) {
    throw new Error("ProtoRaft UI template has no head element.");
  }

  const bootstrap = {
    project,
    displayMode: "prod",
    locked: true,
  };
  const html = template.replace(
    "<head>",
    `<head><script>window.__PROTORAFT_BOOTSTRAP__=${scriptJson(bootstrap)};</script>`,
  );
  const sourceDirectory = await store.siteSourceDirectory(projectId);
  await mkdir(join(sourceDirectory, ".openai"), { recursive: true });
  await writeFile(join(sourceDirectory, "index.html"), html);
  await writeFile(join(sourceDirectory, "build.mjs"), buildScript);
  await writeFile(
    join(sourceDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: `${packageName(project.name)}-review-site`,
        version: "0.1.0",
        private: true,
        type: "module",
        engines: { node: ">=22.13.0" },
        scripts: { build: "node build.mjs" },
      },
      null,
      2,
    )}\n`,
  );
  const hostingPath = join(sourceDirectory, ".openai/hosting.json");
  try {
    await access(hostingPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await writeFile(
      hostingPath,
      `${JSON.stringify({ d1: null, r2: null }, null, 2)}\n`,
    );
  }
  await writeFile(join(sourceDirectory, ".gitignore"), "dist/\n");
  await execFileAsync(process.execPath, ["build.mjs"], {
    cwd: sourceDirectory,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });

  return {
    sourceDirectory,
    projectName: project.name,
    branch: project.defaultBranch,
    displayMode: "prod" as const,
  };
}
