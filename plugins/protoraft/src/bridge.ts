import { App } from "@modelcontextprotocol/ext-apps";
import type { ToolProjectPayload } from "./types";

export type BridgeStatus = "standalone" | "connecting" | "connected" | "error";

export interface ProtoRaftBridge {
  status: BridgeStatus;
  callTool: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  askAgent: (message: string) => Promise<boolean>;
}

function readStructuredContent(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const result = value as {
    structuredContent?: unknown;
    content?: Array<{ type?: string; text?: string }>;
  };

  if (result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent as Record<string, unknown>;
  }

  const textBlock = result.content?.find(
    (block) => block.type === "text" && typeof block.text === "string",
  );
  if (!textBlock?.text) {
    return null;
  }

  try {
    const parsed = JSON.parse(textBlock.text) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function connectProtoRaftApp(
  onProject: (payload: ToolProjectPayload) => void,
): Promise<ProtoRaftBridge> {
  if (window.parent === window) {
    return {
      status: "standalone",
      callTool: async () => null,
      askAgent: async () => false,
    };
  }

  const app = new App(
    { name: "ProtoRaft", version: "1.1.0" },
    { availableDisplayModes: ["inline", "fullscreen"] },
    { autoResize: true },
  );

  app.ontoolresult = (result) => {
    const payload = readStructuredContent(result);
    if (payload?.project) {
      onProject(payload as ToolProjectPayload);
    }
  };

  try {
    await app.connect();
    await app.requestDisplayMode({ mode: "fullscreen" }).catch(() => undefined);

    return {
      status: "connected",
      callTool: async (name, args = {}) => {
        const result = await app.callServerTool({
          name,
          arguments: args,
        });
        if (result.isError) {
          const message = result.content.find((block) => block.type === "text");
          throw new Error(message?.text ?? `ProtoRaft could not run ${name}.`);
        }
        const payload = readStructuredContent(result);
        if (!payload) throw new Error(`ProtoRaft returned no data for ${name}.`);
        return payload;
      },
      askAgent: async (message) => {
        const result = await app.sendMessage({
          role: "user",
          content: [{ type: "text", text: message }],
        });
        return result.isError !== true;
      },
    };
  } catch {
    return {
      status: "error",
      callTool: async () => null,
      askAgent: async () => false,
    };
  }
}
