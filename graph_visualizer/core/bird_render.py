import html
from api.model.graph import Graph
from typing import Optional, Dict
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse

def render_bird_svg(graph: Graph, width: int = 220, height: int = 160, context: Optional[Dict] = None) -> str:
    if not graph.nodes:
        return '<div class="bird-empty">No data</div>'

    margin = 10
    positions = context.get("positions") if context else None
    visualizer = context.get("visualizer") if context else None

    # --- safe xs/ys ---
    try:
        if positions:
            xs = [float(p[0]) for p in positions.values()]
            ys = [float(p[1]) for p in positions.values()]
        else:
            xs = [float(n.attributes.get("x", 0)) for n in graph.nodes]
            ys = [float(n.attributes.get("y", 0)) for n in graph.nodes]
    except Exception:
        xs = ys = [0]

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    graph_w = max_x - min_x if max_x > min_x else 1
    graph_h = max_y - min_y if max_y > min_y else 1

    scale = min((width - 2*margin)/graph_w, (height - 2*margin)/graph_h)
    offset_x = (width - graph_w*scale)/2
    offset_y = (height - graph_h*scale)/2

    pos = {}
    if positions:
        for node_id, coords in positions.items():
            try:
                px, py = coords
                x = (float(px) - min_x) * scale + offset_x
                y = (float(py) - min_y) * scale + offset_y
            except (TypeError, ValueError, IndexError):
                x, y = 0, 0
            pos[node_id] = (x, y)
    else:
        for n in graph.nodes:
            try:
                x = (float(n.attributes.get("x", 0)) - min_x) * scale + offset_x
                y = (float(n.attributes.get("y", 0)) - min_y) * scale + offset_y
            except (TypeError, ValueError):
                x, y = 0, 0
            pos[n.id] = (x, y)

    parts = [f'<svg class="bird-svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">']

    if visualizer == "block":
        # --- Draw blocks instead of circles ---
        parts.append("""
        <style>
        .bird-edges line { stroke:#888; stroke-width:1.2; }
        .bird-nodes .block-rect { fill:#e6f0ff; stroke:#333; rx:3; ry:3; }
        .bird-nodes text { font-size:8px; font-family: sans-serif; pointer-events:none; }
        </style>
        """)
        # edges
        parts.append('<g class="bird-edges">')
        for e in graph.edges:
            if e.from_node.id in pos and e.to_node.id in pos:
                x1, y1 = pos[e.from_node.id]
                x2, y2 = pos[e.to_node.id]
                parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"></line>')
        parts.append('</g>')

        # nodes as blocks
        parts.append('<g class="bird-nodes">')
        for n in graph.nodes:
            x, y = pos[n.id]
            width_block, height_block = 16, 16
            parts.append(
                f'<g class="block-node" data-id="{html.escape(n.id)}" transform="translate({x:.1f},{y:.1f})">'
                f'<rect class="block-rect" width="{width_block}" height="{height_block}" x="-{width_block/2}" y="-{height_block/2}"></rect>'
                f'<text text-anchor="middle" dy=".35em">{html.escape(n.name)}</text>'
                f'</g>'
            )
        parts.append('</g>')

    else:
        # --- Standard bird circles ---
        parts.append("""
        <style>
        .bird-edges line { stroke:#aaa; stroke-width:0.8; }
        .bird-nodes circle { fill:#4da6ff; stroke:#333; r:3; }
        .bird-viewport { fill: none; stroke: red; stroke-width: 1; stroke-dasharray: 3 2; }
        </style>
        """)
        parts.append('<g class="bird-edges">')
        for e in graph.edges:
            if e.from_node.id in pos and e.to_node.id in pos:
                x1, y1 = pos[e.from_node.id]
                x2, y2 = pos[e.to_node.id]
                parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"></line>')
        parts.append('</g>')
        parts.append('<g class="bird-nodes">')
        for n in graph.nodes:
            x, y = pos[n.id]
            parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" data-id="{html.escape(n.id)}"></circle>')
        parts.append('</g>')

    # viewport
    viewport = context.get("viewport") if context else None
    if viewport:
        vx = (viewport["x"] - min_x)*scale + offset_x
        vy = (viewport["y"] - min_y)*scale + offset_y
        vwidth = viewport["width"]*scale
        vheight = viewport["height"]*scale
        vx = max(margin, min(vx, width - margin - vwidth))
        vy = max(margin, min(vy, height - margin - vheight))
        parts.append(
            f'<rect class="bird-viewport" x="{vx:.1f}" y="{vy:.1f}" width="{vwidth:.1f}" height="{vheight:.1f}" '
            f'style="fill:none;stroke:red;stroke-width:1;stroke-dasharray:3 2;"></rect>'
        )
    else:
        parts.append(
            f'<rect class="bird-viewport" x="{margin}" y="{margin}" width="50" height="40" '
            f'style="fill:none;stroke:red;stroke-width:1;stroke-dasharray:3 2;"></rect>'
        )

    parts.append('</svg>')
    return "".join(parts)
