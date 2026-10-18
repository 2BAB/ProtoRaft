import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { MousePointer2 } from "lucide-react";
import { useMemo } from "react";
import type {
  FlowConnection,
  PrototypeScreen,
  ScreenId,
} from "../types";
import { MorrowPreview } from "./MorrowPreview";

interface ScreenNodeData extends Record<string, unknown> {
  screen: PrototypeScreen;
}

type ScreenFlowNode = Node<ScreenNodeData, "screen">;

function ScreenNode({ data, selected }: NodeProps<ScreenFlowNode>) {
  const { screen } = data;

  return (
    <div
      className={`screen-map-node ${selected ? "is-selected" : ""}`}
      data-screen-id={screen.id}
    >
      <Handle type="target" position={Position.Left} />
      <div className="screen-map-node-preview" aria-hidden="true" inert>
        <MorrowPreview
          activeScreen={screen.id}
          onScreenChange={() => undefined}
        />
      </div>
      <div className="screen-map-node-meta">
        <span>
          <strong>{screen.title}</strong>
          <small>{screen.route}</small>
        </span>
        <MousePointer2 size={14} aria-label="Interactive screen" />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  screen: ScreenNode,
};

interface ScreenMapProps {
  screens: PrototypeScreen[];
  connections: FlowConnection[];
  selectedId: ScreenId;
  onSelect: (id: ScreenId) => void;
}

export function ScreenMap({
  screens,
  connections,
  selectedId,
  onSelect,
}: ScreenMapProps) {
  const nodes = useMemo<ScreenFlowNode[]>(
    () =>
      screens.map((screen) => ({
        id: screen.id,
        type: "screen",
        position: {
          x: screen.position.x,
          y: screen.position.y * 1.2,
        },
        data: { screen },
        selected: screen.id === selectedId,
        draggable: false,
        focusable: true,
        ariaRole: "button",
        ariaLabel: `${screen.title} screen`,
      })),
    [screens, selectedId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      connections.map((connection) => ({
        id: `screen-${connection.id}`,
        source: connection.source,
        target: connection.target,
        label: connection.label,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#737373",
          width: 16,
          height: 16,
        },
        style: {
          stroke: "#737373",
          strokeWidth: 1.3,
        },
        labelStyle: {
          fill: "#525252",
          fontSize: 11,
          fontWeight: 500,
        },
        labelBgStyle: {
          fill: "#f7f7f7",
          fillOpacity: 0.96,
        },
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 4,
      })),
    [connections],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.3}
      maxZoom={1.2}
      nodesConnectable={false}
      nodesDraggable={false}
      elementsSelectable
      onNodeClick={(_, node) => onSelect(node.id as ScreenId)}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        color="#b8b8b8"
        gap={20}
        size={1.35}
        variant={BackgroundVariant.Dots}
      />
      <Controls
        position="bottom-left"
        showInteractive={false}
        orientation="horizontal"
      />
    </ReactFlow>
  );
}
