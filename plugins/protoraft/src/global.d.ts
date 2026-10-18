import type { DisplayMode, PrototypeProject } from "./types";

declare global {
  interface Window {
    __PROTORAFT_BOOTSTRAP__?: {
      project: PrototypeProject;
      displayMode: DisplayMode;
      locked: boolean;
    };
  }
}

export {};
