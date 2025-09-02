import json
import html
import numpy as np
import networkx as nx
from typing import Optional, Dict
from api.components.visualizer import VisualizerPlugin
from api.model.graph import Graph

class SimpleVisualizer(VisualizerPlugin):
    key = "simple"
    
    def render(self, graph: Graph, width: int = 900, height: int = 600, context: Optional[Dict] = None) -> str:
        if not graph.nodes:
            return '<div class="viz-empty">No data</div>'

        # --- Convert to networkx graph ---
        G = nx.Graph()
        for node in graph.nodes:
            G.add_node(node.id)
        for e in graph.edges:
            G.add_edge(e.from_node.id, e.to_node.id)

        # --- Force-directed layout (Fruchterman-Reingold) ---       
        initial_pos = nx.shell_layout(G)
        layout = nx.spring_layout(G, pos=initial_pos, k=0.1, iterations=100, seed=42)

        if context and "positions" in context:
            for node in graph.nodes:
                pos_saved = context["positions"].get(node.id)
                if pos_saved:
                    layout[node.id] = (pos_saved["x"], pos_saved["y"])
                    
        # --- Add a little random "noise" to break up overlaps ---
        for node in layout:
            layout[node] += 0.05 * np.random.randn(2)


        # --- Normalization + centering ---
        xs = [coord[0] for coord in layout.values()]
        ys = [coord[1] for coord in layout.values()]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)

        scale_x = (width - 80) / (max_x - min_x)
        scale_y = (height - 80) / (max_y - min_y)
        scale = min(scale_x, scale_y)

        pos = {}
        for node_id, (x, y) in layout.items():
            nx_ = (x - min_x) * scale
            ny_ = (y - min_y) * scale
            pos[node_id] = (nx_, ny_)

        # --- Calculate the bounding box after scaling ---
        xs2 = [x for x, _ in pos.values()]
        ys2 = [y for _, y in pos.values()]
        min_x2, max_x2 = min(xs2), max(xs2)
        min_y2, max_y2 = min(ys2), max(ys2)

        graph_w = max_x2 - min_x2
        graph_h = max_y2 - min_y2

        # --- Center within width × height ---
        offset_x = (width - graph_w) / 2 - min_x2
        offset_y = (height - graph_h) / 2 - min_y2

        for node_id, (x, y) in pos.items():
            pos[node_id] = (x + offset_x, y + offset_y)

        # --- SVG skeleton ---
        parts = [f'<svg class="gv-svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="Graph">']

        parts.append("""
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#888"></path>
            </marker>
            <style>
            .edges line { stroke:#888; stroke-width:1.2; }
            .edges line.directed { marker-end:url(#arrow); }
            .nodes text { font-size:11px; font-family: ui-sans-serif, system-ui, sans-serif; pointer-events:none; }
            .nodes circle { fill:#e6f0ff; stroke:#333; }
            .node.dragging circle { opacity:.85; }
            </style>
        </defs>
        """)

        # --- Viewport group ---
        parts.append(f'  <g class="viewport">')
        parts.append(f'    <rect class="pz-capture" x="0" y="0" width="{width}" height="{height}" fill="transparent"></rect>')

        # --- Edges ---
        parts.append('    <g class="edges">')
        for e in graph.edges:
            x1, y1 = pos[e.from_node.id]
            x2, y2 = pos[e.to_node.id]
            cls = "directed" if e.directed else ""
            parts.append(
                f'<line class="{cls}" data-from="{html.escape(e.from_node.id)}" data-to="{html.escape(e.to_node.id)}" '
                f'x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}"></line>'
            )
        parts.append('    </g>')

        # --- Nodes ---
        parts.append('    <g class="nodes">')
        for node in graph.nodes:
            x, y = pos[node.id]
            attrs_json = json.dumps(node.attributes, ensure_ascii=False)
            attrs_json = html.escape(attrs_json, quote=True)
            parts.append(
                f'<g class="node" data-id="{html.escape(node.id)}" data-name="{html.escape(node.name)}" '
                f'data-attrs="{attrs_json}" transform="translate({x:.2f},{y:.2f})">'
                f'  <circle r="16"></circle>'
                f'  <text text-anchor="middle" dy="4">{html.escape(node.name)}</text>'
                f'</g>'
            )
        parts.append('    </g>')

        parts.append('  </g>')
        parts.append('</svg>')
        return "".join(parts)
