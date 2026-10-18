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
import { FileText } from "lucide-react";
import { useMemo } from "react";
import type {
  FlowConnection,
  PrototypeScreen,
  ScreenId,
} from "../types";

interface WireframeNodeData extends Record<string, unknown> {
  screen: PrototypeScreen;
}

type WireframeFlowNode = Node<WireframeNodeData, "wireframe">;

function WireframeNode({ data, selected }: NodeProps<WireframeFlowNode>) {
  const { screen } = data;
  return (
    <div
      className={`wireframe-node ${selected ? "is-selected" : ""}`}
      data-screen-id={screen.id}
    >
      <Handle type="target" position={Position.Left} />
      <div className="wireframe-node-image">
        <img src={screen.image} alt={`${screen.title} wireframe`} />
      </div>
      <div className="wireframe-node-meta">
        <span>
          <strong>{screen.title}</strong>
          <small>{screen.route}</small>
        </span>
        <FileText size={14} aria-label="Linked document" />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  wireframe: WireframeNode,
};

interface WireframeMapProps {
  screens: PrototypeScreen[];
  connections: FlowConnection[];
  selectedId: ScreenId;
  onSelect: (id: ScreenId) => void;
}

export function WireframeMap({
  screens,
  connections,
  selectedId,
  onSelect,
}: WireframeMapProps) {
  const nodes = useMemo<WireframeFlowNode[]>(
    () =>
      screens.map((screen) => ({
        id: screen.id,
        type: "wireframe",
        position: screen.position,
        data: { screen },
        selected: screen.id === selectedId,
        draggable: false,
      })),
    [screens, selectedId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      connections.map((connection) => ({
        id: connection.id,
        source: connection.source,
        target: connection.target,
        label: connection.label,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#74807f",
          width: 16,
          height: 16,
        },
        style: {
          stroke: "#74807f",
          strokeWidth: 1.3,
        },
        labelStyle: {
          fill: "#596666",
          fontSize: 11,
          fontWeight: 500,
        },
        labelBgStyle: {
          fill: "#f7f7f7",
          fillOpacity: 0.94,
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
      fitViewOptions={{ padding: 0.16 }}
      minZoom={0.45}
      maxZoom={1.35}
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
