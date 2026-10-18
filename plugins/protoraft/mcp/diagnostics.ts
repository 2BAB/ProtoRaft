import {
  appendFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const MAX_LOG_BYTES = 2 * 1024 * 1024;
const RETAINED_LINES = 2000;

export interface DiagnosticEvent {
  schemaVersion: "0.1";
  timestamp: string;
  operationId?: string;
  component: "mcp" | "app";
  event: string;
  status: "started" | "succeeded" | "failed" | "accepted" | "rejected";
  durationMs?: number;
  projectId?: string;
  error?: {
    name: string;
    message: string;
  };
}

function logPath() {
  if (process.env.PROTORAFT_DIAGNOSTIC_LOG) {
    return process.env.PROTORAFT_DIAGNOSTIC_LOG;
  }
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  return join(codexHome, "log", "protoraft-events.jsonl");
}

function summarizeError(error: unknown) {
  const value = error instanceof Error ? error : new Error(String(error));
  return {
    name: value.name,
    message: value.message.replaceAll(homedir(), "~").slice(0, 400),
  };
}

async function trimLogIfNeeded(path: string) {
  try {
    const metadata = await stat(path);
    if (metadata.size <= MAX_LOG_BYTES) {
      return;
    }
    const content = await readFile(path, "utf8");
    const retained = content.trimEnd().split("\n").slice(-RETAINED_LINES);
    await writeFile(path, retained.length ? `${retained.join("\n")}\n` : "");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function recordDiagnostic(
  event: Omit<DiagnosticEvent, "schemaVersion" | "timestamp">,
) {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return;
  }
  const path = logPath();
  try {
    await mkdir(dirname(path), { recursive: true });
    await trimLogIfNeeded(path);
    await appendFile(
      path,
      `${JSON.stringify({
        schemaVersion: "0.1",
        timestamp: new Date().toISOString(),
        ...event,
      })}\n`,
    );
  } catch {
    // Diagnostics must never break the product workflow they observe.
  }
}

export async function trackDiagnostic<T>(
  component: DiagnosticEvent["component"],
  event: string,
  details: Pick<DiagnosticEvent, "projectId">,
  operation: () => Promise<T>,
) {
  const operationId = randomUUID();
  const startedAt = Date.now();
  await recordDiagnostic({
    component,
    event,
    status: "started",
    operationId,
    ...details,
  });
  try {
    const value = await operation();
    await recordDiagnostic({
      component,
      event,
      status: "succeeded",
      operationId,
      durationMs: Date.now() - startedAt,
      ...details,
    });
    return value;
  } catch (error) {
    await recordDiagnostic({
      component,
      event,
      status: "failed",
      operationId,
      durationMs: Date.now() - startedAt,
      error: summarizeError(error),
      ...details,
    });
    throw error;
  }
}

export async function readRecentDiagnostics(limit = 50) {
  const path = logPath();
  try {
    const content = await readFile(path, "utf8");
    const entries = content
      .trimEnd()
      .split("\n")
      .slice(-Math.max(1, Math.min(limit, 200)))
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as DiagnosticEvent];
        } catch {
          return [];
        }
      });
    return { path, entries };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { path, entries: [] };
    }
    throw error;
  }
}
