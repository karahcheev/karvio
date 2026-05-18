import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ComponentDto, ComponentGraphDto } from "@/shared/api";

// ── Risk level colours ────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  low:      { bg: "#f0fdf4", border: "#22c55e", text: "#15803d" },
  medium:   { bg: "#fefce8", border: "#eab308", text: "#854d0e" },
  high:     { bg: "#fff7ed", border: "#f97316", text: "#9a3412" },
  critical: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
};

function riskColors(level: string) {
  return RISK_COLORS[level] ?? RISK_COLORS.low;
}

const NODE_W = 200;
const NODE_H = 72;

// ── Hover context ─────────────────────────────────────────────────────────────
// Passed via context so that changing hover state does NOT cause React Flow
// to reconcile the nodes/edges arrays — only the leaf ComponentNode re-renders.

interface HoverState {
  hoveredId: string | null;
  connectedIds: Set<string> | null;
}

const HoverCtx = createContext<HoverState>({ hoveredId: null, connectedIds: null });

// ── Custom node ───────────────────────────────────────────────────────────────

type ComponentNodeData = {
  component: ComponentDto;
  selected: boolean;
};

function ComponentNode({ data }: NodeProps) {
  const { component, selected } = data as ComponentNodeData;
  const { hoveredId, connectedIds } = useContext(HoverCtx);
  const colors = riskColors(component.risk_level);

  const isHovered = hoveredId === component.id;
  const isConnected = connectedIds !== null && connectedIds.has(component.id);
  const isDimmed = connectedIds !== null && !connectedIds.has(component.id);

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        style={{
          width: NODE_W,
          background: colors.bg,
          borderColor: selected
            ? "var(--color-primary, #6366f1)"
            : isHovered || isConnected
              ? colors.border
              : colors.border,
          borderWidth: selected || isHovered ? 2 : isConnected ? 2 : 1.5,
          color: colors.text,
          opacity: isDimmed ? 0.18 : 1,
          boxShadow: selected
            ? "0 0 0 3px rgba(99,102,241,0.3)"
            : isHovered
              ? `0 4px 20px ${colors.border}88, 0 0 0 3px ${colors.border}44`
              : isConnected
                ? `0 2px 8px ${colors.border}44`
                : undefined,
          transform: isHovered ? "scale(1.03)" : undefined,
          transition: "opacity 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease",
          zIndex: isHovered ? 10 : undefined,
        }}
        className="rounded-lg border px-3 py-2 cursor-pointer"
      >
        <div className="text-[11px] font-mono opacity-60 truncate">{component.key}</div>
        <div className="text-[13px] font-semibold leading-tight truncate mt-0.5">{component.name}</div>
        <div
          className="mt-1.5 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full inline-block"
          style={{ background: colors.border + "22" }}
        >
          {component.risk_level}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
}

const NODE_TYPES = { component: ComponentNode };

// ── Dagre layout ──────────────────────────────────────────────────────────────

function computeLayout(
  components: ComponentDto[],
  deps: { id: string; source: string; target: string }[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph({ directed: true });
  g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 28, edgesep: 10, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const c of components) g.setNode(c.id, { width: NODE_W, height: NODE_H });
  for (const d of deps) g.setEdge(d.source, d.target);
  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const c of components) {
    const n = g.node(c.id);
    if (n) positions.set(c.id, { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 });
  }
  return positions;
}

// ── Main component ────────────────────────────────────────────────────────────

interface ComponentGraphProps {
  graph: ComponentGraphDto;
  selectedComponentId: string | null;
  onSelectComponent: (id: string) => void;
}

export function ComponentGraph({ graph, selectedComponentId, onSelectComponent }: ComponentGraphProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rawDeps = useMemo(
    () => graph.dependencies.map((d) => ({
      id: d.id,
      source: d.source_component_id,
      target: d.target_component_id,
    })),
    [graph.dependencies],
  );

  // Keep a ref so mouse handlers always see the latest deps without being recreated
  const rawDepsRef = useRef(rawDeps);
  rawDepsRef.current = rawDeps;

  const connectedIds = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId) return null;
    const ids = new Set([hoveredNodeId]);
    for (const dep of rawDeps) {
      if (dep.source === hoveredNodeId) ids.add(dep.target);
      if (dep.target === hoveredNodeId) ids.add(dep.source);
    }
    return ids;
  }, [hoveredNodeId, rawDeps]);

  const hoverCtxValue = useMemo<HoverState>(
    () => ({ hoveredId: hoveredNodeId, connectedIds }),
    [hoveredNodeId, connectedIds],
  );

  const positions = useMemo(() => computeLayout(graph.components, rawDeps), [graph.components, rawDeps]);

  // Nodes do NOT carry hover state — ComponentNode reads it from context.
  // This means React Flow never sees a new nodes array on hover → no flickering.
  const nodes: Node[] = useMemo(
    () =>
      graph.components.map((c) => ({
        id: c.id,
        type: "component",
        position: positions.get(c.id) ?? { x: 0, y: 0 },
        data: { component: c, selected: c.id === selectedComponentId } satisfies ComponentNodeData,
        selectable: true,
      })),
    [graph.components, positions, selectedComponentId],
  );

  // Edges carry hover state so their colour/animation can change.
  // Edge re-renders are lightweight compared to node re-renders.
  const edges: Edge[] = useMemo(() => {
    return graph.dependencies.map((d) => {
      const isActive =
        hoveredNodeId !== null &&
        (d.source_component_id === hoveredNodeId || d.target_component_id === hoveredNodeId);
      const isDimmed = hoveredNodeId !== null && !isActive;
      const stroke = isActive ? "#6366f1" : "#94a3b8";

      return {
        id: d.id,
        source: d.source_component_id,
        target: d.target_component_id,
        type: "smoothstep",
        animated: isActive,
        style: {
          stroke,
          strokeWidth: isActive ? 2.5 : 1.5,
          opacity: isDimmed ? 0.06 : 1,
          transition: "opacity 0.15s ease",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 },
      };
    });
  }, [graph.dependencies, hoveredNodeId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => { onSelectComponent(node.id); },
    [onSelectComponent],
  );

  const handleNodeMouseEnter: NodeMouseHandler = useCallback((_e, node) => {
    // Cancel any pending leave so moving between nodes doesn't flash to "no hover"
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setHoveredNodeId(node.id);
  }, []);

  const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    // Small delay: if mouse immediately enters another node, the enter cancels this
    leaveTimer.current = setTimeout(() => {
      setHoveredNodeId(null);
      leaveTimer.current = null;
    }, 80);
  }, []);

  return (
    <HoverCtx.Provider value={hoverCtxValue}>
      <div className="h-full w-full" style={{ minHeight: 400 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.25}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="var(--color-border, #e2e8f0)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </HoverCtx.Provider>
  );
}
