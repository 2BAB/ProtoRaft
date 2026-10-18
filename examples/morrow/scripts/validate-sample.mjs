import { execFileSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

async function readJson(path) {
  try {
    return JSON.parse(await readFile(join(root, path), "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
}

async function requireFile(path, minimumBytes = 1) {
  try {
    await access(join(root, path));
    const file = await stat(join(root, path));
    if (!file.isFile() || file.size < minimumBytes) {
      errors.push(`${path}: expected a file of at least ${minimumBytes} bytes`);
    }
  } catch {
    errors.push(`${path}: missing`);
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

for (const node of nodes) {
  const screen = await readJson(node.screen);
  if (!screen) {
    continue;
  }
  const screenDirectory = dirname(node.screen);
  await requireFile(join(screenDirectory, screen.wireframe), 10_000);
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
  await requireFile(document.path, 200);
  if (!(document.screenIds?.length > 0)) {
    errors.push(`${document.path}: screenIds must be non-empty`);
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
await requireFile("hifi/editorial-bridge.png", 10_000);

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
if (insideGit) {
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
