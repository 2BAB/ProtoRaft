import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const pluginPath = join(root, "plugins", "protoraft");
const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
const systemSkills = join(codexHome, "skills", ".system");
const pluginValidator = join(
  systemSkills,
  "plugin-creator",
  "scripts",
  "validate_plugin.py",
);
const skillValidator = join(
  systemSkills,
  "skill-creator",
  "scripts",
  "quick_validate.py",
);
const python = process.env.PYTHON || "python3";

for (const validator of [pluginValidator, skillValidator]) {
  if (!existsSync(validator)) {
    console.error(
      `Missing Codex validator: ${validator}\nInstall or update Codex, or set CODEX_HOME to the active Codex profile.`,
    );
    process.exit(1);
  }
}

function runValidator(script, target) {
  const result = spawnSync(python, [script, target], {
    cwd: root,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runValidator(pluginValidator, pluginPath);

const skillsPath = join(pluginPath, "skills");
for (const entry of readdirSync(skillsPath, { withFileTypes: true })
  .filter((item) => item.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  runValidator(skillValidator, join(skillsPath, entry.name));
}
