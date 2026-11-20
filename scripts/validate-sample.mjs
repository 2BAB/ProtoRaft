import { execFileSync } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

async function localFile(path) {
  if (typeof path !== "string" || !path || isAbsolute(path)) {
    throw new Error("expected a project-relative path");
  }
  const projectRoot = await realpath(root);
  const file = await realpath(resolve(projectRoot, path));
  const location = relative(projectRoot, file);
  if (location.startsWith("..") || isAbsolute(location)) {
    throw new Error("path leaves the sample directory");
  }
  if (!(await stat(file)).isFile()) throw new Error("expected a file");
  return file;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(await localFile(path), "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
}

async function requireFile(path, minimumBytes = 1) {
  try {
    const file = await localFile(path);
    if ((await stat(file)).size < minimumBytes) {
      throw new Error(`expected a file of at least ${minimumBytes} bytes`);
    }
    return file;
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
}

async function requirePng(path) {
  const file = await requireFile(path, 10_000);
  if (!file) return;

  const bytes = await readFile(file);
  const expected = Buffer.from("89504e470d0a1a0a", "hex");
  if (!bytes.subarray(0, 8).equals(expected) ||
      bytes.toString("ascii", 12, 16) !== "IHDR" ||
      !bytes.readUInt32BE(16) || !bytes.readUInt32BE(20) ||
      bytes.toString("ascii", bytes.length - 8, bytes.length - 4) !== "IEND") {
    errors.push(`${path}: expected a complete PNG with non-zero dimensions`);
  }
}

async function validateMarkdownLinks(path) {
  const file = await requireFile(path, 200);
  if (!file) return;

  const markdown = await readFile(file, "utf8");
  for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    const destination = match[1].trim();
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(destination)) continue;
    const [pathname] = destination.split(/[?#]/);
    if (pathname) await requireFile(join(dirname(path), pathname));
  }
}

function git(args, allowFailure = false) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    errors.push(`git ${args.join(" ")}: ${error.stderr?.trim() || error.message}`);
    return "";
  }
}

const manifest = await readJson("protoraft.project.json");
const flow = manifest ? await readJson(manifest.flow) : null;
const components = manifest
  ? await readJson(manifest.designSystem?.components)
  : null;
const tokens = manifest ? await readJson(manifest.designSystem?.tokens) : null;
const routes = manifest?.hifi ? await readJson(manifest.hifi.routes) : null;
const discussions = manifest?.discussions ? await readJson(manifest.discussions) : null;
const reviews = manifest?.collaboration?.reviewScenarios
  ? await readJson(manifest.collaboration.reviewScenarios)
  : null;

if (manifest?.schemaVersion !== "0.1") {
  errors.push("protoraft.project.json: schemaVersion must be 0.1");
}

const nodes = flow?.nodes ?? [];
const edges = flow?.edges ?? [];
if (nodes.length !== 5) {
  errors.push(`flows: expected 5 screens, found ${nodes.length}`);
}
if (edges.length !== 4) {
  errors.push(`flows: expected 4 connections, found ${edges.length}`);
}

const nodeIds = new Set(nodes.map(({ id }) => id));
const documentIds = new Set(manifest?.documents?.map(({ id }) => id));
const routeByScreen = new Map();
if (nodeIds.size !== nodes.length) errors.push("flows: duplicate screen ID");
if (new Set(edges.map(({ id }) => id)).size !== edges.length) {
  errors.push("flows: duplicate edge ID");
}
for (const { source, target, id } of edges) {
  if (!nodeIds.has(source) || !nodeIds.has(target)) {
    errors.push(`flows: edge ${id} references an unknown screen`);
  }
}

for (const node of nodes) {
  const screen = await readJson(node.screen);
  if (!screen) {
    continue;
  }
  const screenDirectory = dirname(node.screen);
  if (typeof screen.wireframe !== "string" || !screen.wireframe || isAbsolute(screen.wireframe)) {
    errors.push(`${node.screen}: a relative wireframe path is required`);
  } else {
    await requirePng(join(screenDirectory, screen.wireframe));
  }
  if (screen.id !== node.id) errors.push(`${node.screen}: ID does not match the flow node`);
  routeByScreen.set(node.id, screen.route);
  for (const action of screen.actions ?? []) {
    if (!nodeIds.has(action.target)) errors.push(`${node.screen}: unknown action target ${action.target}`);
  }
  for (const id of screen.linkedDocuments ?? []) {
    if (!documentIds.has(id)) errors.push(`${node.screen}: unknown linked document ${id}`);
  }
  for (const key of ["id", "title", "route", "purpose"]) {
    if (!screen[key]) {
      errors.push(`${node.screen}: ${key} is required`);
    }
  }
  if (!(screen.actions?.length > 0) || !(screen.states?.length > 0)) {
    errors.push(`${node.screen}: actions and states must be non-empty`);
  }
}

for (const document of manifest?.documents ?? []) {
  await validateMarkdownLinks(document.path);
  if (!(document.screenIds?.length > 0)) {
    errors.push(`${document.path}: screenIds must be non-empty`);
  }
  if (document.screenIds?.some((id) => !nodeIds.has(id))) {
    errors.push(`${document.path}: linked screen does not exist`);
  }
}

for (const note of discussions?.notes ?? []) {
  if (!nodeIds.has(note.screenId) || !note.body || !Number.isFinite(Date.parse(note.createdAt))) {
    errors.push(`discussions: note ${note.id} needs a valid screen, body, and date`);
  }
}

const componentList = components?.components ?? [];
if (componentList.length < 6) {
  errors.push(`design/components.json: expected at least 6 components`);
}
for (const component of componentList) {
  if (!component.description || !(component.states?.length > 0)) {
    errors.push(
      `design/components.json: ${component.id} needs a description and states`,
    );
  }
}

for (const [group, values] of Object.entries(tokens ?? {})) {
  if (group.startsWith("$") || typeof values !== "object" || values === null) {
    continue;
  }
  for (const [name, token] of Object.entries(values)) {
    if (!token?.$description) {
      errors.push(`design/tokens.tokens.json: ${group}.${name} needs a description`);
    }
  }
}

if (routes?.routes?.length !== 5) {
  errors.push(`hifi/routes.json: expected 5 routes`);
}
const routePaths = new Set();
for (const route of routes?.routes ?? []) {
  if (!nodeIds.has(route.screenId) || routeByScreen.get(route.screenId) !== route.path ||
      routePaths.has(route.path)) {
    errors.push(`hifi/routes.json: invalid or duplicate route ${route.path}`);
  }
  routePaths.add(route.path);
}
if (!routePaths.has(manifest?.hifi?.defaultRoute)) {
  errors.push("hifi/routes.json: default route is missing");
}
await requirePng("hifi/editorial-bridge.png");

const scenario = reviews?.comparisons?.find(
  (item) =>
    item.base === "main" && item.compare === "feature/morrow-listen",
);
if (!scenario) {
  errors.push("collaboration: missing main vs feature/morrow-listen scenario");
} else if (
  !scenario.changes?.some(
    (change) =>
      change.path === "documents/interaction-spec.md" &&
      change.recommendation &&
      change.resolutionCriteria?.length >= 5,
  )
) {
  errors.push("collaboration: interaction decision needs recommendation and criteria");
}

const insideGit = git(["rev-parse", "--is-inside-work-tree"], true) === "true";
if (insideGit && !process.argv.includes("--structure-only")) {
  const mainRef =
    git(["rev-parse", "--verify", "main^{commit}"], true)
      ? "main"
      : git(["rev-parse", "--verify", "origin/main^{commit}"], true)
        ? "origin/main"
        : "";
  const featureRef =
    git(["rev-parse", "--verify", "feature/morrow-listen^{commit}"], true)
      ? "feature/morrow-listen"
      : git(
            [
              "rev-parse",
              "--verify",
              "origin/feature/morrow-listen^{commit}",
            ],
            true,
          )
        ? "origin/feature/morrow-listen"
        : "";

  if (!mainRef) {
    errors.push("git: main branch is missing");
  }
  if (!featureRef) {
    errors.push("git: feature/morrow-listen branch is missing");
  }
  if (mainRef && featureRef) {
    const expected = [
      "design/components.json",
      "documents/interaction-spec.md",
      "screens/listen/screen.json",
      "screens/listen/wireframe.png",
    ];
    const changed = git([
      "diff",
      "--relative",
      "--name-only",
      `${mainRef}...${featureRef}`,
      "--",
      ".",
    ])
      .split("\n")
      .filter(Boolean)
      .sort();
    if (JSON.stringify(changed) !== JSON.stringify(expected)) {
      errors.push(
        `git: expected four scenario changes, found ${changed.join(", ") || "none"}`,
      );
    }

    const mainCommit = git(["rev-parse", `${mainRef}^{commit}`]);
    const featureCommit = git(["rev-parse", `${featureRef}^{commit}`]);
    const mergeBase = git(["merge-base", mainRef, featureRef]);
    if (!mainCommit || !featureCommit || !mergeBase) {
      errors.push("git: main and feature/morrow-listen must share a merge base");
    } else if (mainCommit === featureCommit) {
      errors.push("git: feature/morrow-listen must diverge from main");
    } else if (mergeBase !== mainCommit) {
      const mainSampleDiff = git([
        "diff",
        "--relative",
        "--name-only",
        `${mergeBase}..${mainRef}`,
        "--",
        ".",
      ]);
      if (mainSampleDiff) {
        errors.push(
          "git: feature/morrow-listen is behind main on sample artifacts",
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("ProtoRaft sample validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  "ProtoRaft sample is valid: 5 screens, 4 connections, 5 preview routes, and the intentional collaboration scenario are present.",
);
