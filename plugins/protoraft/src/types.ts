export type WorkspaceSection = "product" | "design" | "collaboration";
export type ProductWorkspaceView = "wireframes" | "documents";
export type DesignWorkspaceView = "system" | "preview";
export type DisplayMode = "local" | "prod";

export type WireframeViewMode = "map" | "list";
export type ScreenId = "today" | "story" | "focus" | "listen" | "saved";

export interface PrototypeAction {
  label: string;
  target: ScreenId;
}

export interface PrototypeScreen {
  id: ScreenId;
  title: string;
  route: string;
  summary: string;
  purpose: string;
  image: string;
  stage: "wireframe" | "review" | "approved";
  position: {
    x: number;
    y: number;
  };
  entry: string[];
  actions: PrototypeAction[];
  states: string[];
  linkedDocumentIds: string[];
  updatedAt: string;
}

export interface FlowConnection {
  id: string;
  source: ScreenId;
  target: ScreenId;
  label: string;
}

export interface ProductDocument {
  id: string;
  title: string;
  filename: string;
  summary: string;
  content: string;
  screenIds: ScreenId[];
  updatedAt: string;
  status: "draft" | "review" | "approved";
}

export interface DiscussionNote {
  id: string;
  screenId: ScreenId;
  author: string;
  body: string;
  createdAt: string;
}

export interface DesignToken {
  path: string;
  group: "Color" | "Typography" | "Space" | "Radius";
  value: string;
  description: string;
  swatch?: string;
}

export interface ComponentContract {
  id: string;
  name: string;
  category: string;
  variants: string[];
  states: string[];
  platforms: Array<"Web" | "iOS" | "Android">;
  description: string;
}

export interface BranchChange {
  path: string;
  kind: "added" | "modified" | "deleted" | "conflict";
  area: "Wireframe" | "Document" | "Design system" | "HiFi";
  summary: string;
  baseContent?: string;
  compareContent?: string;
  recommendation?: string;
}

export interface BranchSnapshot {
  name: string;
  gitRef?: string;
  label: string;
  author: string;
  commit: string;
  updatedAt: string;
  changes: BranchChange[];
}

export interface ReviewStatus {
  state: "not-checked" | "current" | "updates-available" | "error";
  checkedAt?: string;
  summary?: string;
  changedArtifacts?: number;
}

export interface PrototypeProject {
  projectId: string;
  name: string;
  repositoryName?: string;
  version: string;
  summary: string;
  defaultBranch: string;
  screens: PrototypeScreen[];
  connections: FlowConnection[];
  discussions: DiscussionNote[];
  discussionRevision?: string;
  documents: ProductDocument[];
  tokens: DesignToken[];
  components: ComponentContract[];
  branches: BranchSnapshot[];
  reviewStatus?: ReviewStatus;
}

export interface ToolProjectPayload {
  project?: PrototypeProject;
}
