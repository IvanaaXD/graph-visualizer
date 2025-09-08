import json
from api.model.graph import Graph, Node

def render_tree_details(graph: Graph) -> str:
    def render_node(node: Node) -> str:
        return f'''
        <li data-node-id="{node.id}" class="parent">
            <div class="node-header">
                <span class="toggle">+</span>
                <span class="tree-label">{node.name}
                    <span class="tooltip"></span>
                </span>
            </div>
            <ul class="nested" style="display:none;"></ul>
        </li>
        '''

    def get_neighbors(node: Node):
        neighbors = set()
        for edge in graph.edges:
            if edge.from_node.id == node.id:
                neighbors.add(edge.to_node)
            elif edge.to_node.id == node.id:
                neighbors.add(edge.from_node)
        return list(neighbors) 
    
    if not getattr(graph, "nodes", None):
        return '<div class="component-tree empty">No nodes</div>'

    tree_html = "".join(render_node(node) for node in graph.nodes)

    graph_json = json.dumps([
        {
            "id": n.id,
            "name": n.name,
            "attributes": n.attributes,  
            "neighbors": [m.id for m in get_neighbors(n)]
        }
        for n in graph.nodes
    ], ensure_ascii=False)

    return f'''
    <style>
        .toggle {{
            color: var(--text);
            font-weight: bold;
            cursor: pointer;
            margin-right: 5px;
        }}
        .tree-label {{
            color: var(--text);
            cursor: default;
            position: relative;
        }}
        .tooltip {{
            display: none;
            position: absolute;
            background: color-mix(in oklab, var(--panel), black 20%);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            white-space: pre-line;
            min-width: 220px;
            max-width: 400px;
            z-index: 1000;
            top: 100%;
            left: 0;
            margin-top: 4px;
            box-shadow: var(--shadow);
        }}
        .tree-label:hover .tooltip {{
            display: block;
        }}
    </style>

    <ul class="component-tree tree-root">
        {tree_html}
    </ul>

    <script>
    const graphData = {{ nodes: {graph_json} }};

    function getNodeById(id) {{
        return graphData.nodes.find(n => n.id == id);
    }}

    function renderTooltip(node) {{
        let attrs = Object.entries(node.attributes || {{}})
            .map(([k, v]) => `${{k}}: ${{v}}`)
            .join("<br>");
        if (!attrs) attrs = "(no attributes)";
        return `Naziv: ${{node.name}}\\n${{attrs}}`;
    }}

    function renderNodeItem(node) {{
        const hasNeighbors = node.neighbors && node.neighbors.length > 0;
        const toggleHtml = hasNeighbors ? '<span class="toggle">+</span>' : '';
        return `<li data-node-id="${{node.id}}">
                    <div class="node-header">
                        ${{toggleHtml}}
                        <span class="tree-label">${{node.name}}
                            <span class="tooltip">${{renderTooltip(node)}}</span>
                        </span>
                    </div>
                    <ul class="nested" style="display:none;"></ul>
                </li>`;
    }}

    function attachToggleEvents(root) {{
        root.querySelectorAll(".toggle").forEach(function(toggle) {{
            toggle.onclick = function(e) {{
                const li = e.target.closest("li");
                const nodeId = li.getAttribute("data-node-id");
                const nested = li.querySelector(".nested");
                const node = getNodeById(nodeId);
                if (!node) return;

                if (nested.style.display === "none") {{
                    nested.innerHTML = node.neighbors.map(neighId => {{
                        const neigh = getNodeById(neighId);
                        return renderNodeItem(neigh);
                    }}).join("");
                    nested.style.display = "block";
                    e.target.textContent = "-";
                    attachToggleEvents(nested);
                }} else {{
                    nested.style.display = "none";
                    nested.innerHTML = "";
                    e.target.textContent = "+";
                }}
                e.stopPropagation();
            }}
        }});
    }}

    document.addEventListener("DOMContentLoaded", function() {{
        const root = document.querySelector(".component-tree");
        attachToggleEvents(root);

        // inicijalni tooltip render za root čvorove
        root.querySelectorAll("li").forEach(li => {{
            const nodeId = li.getAttribute("data-node-id");
            const node = getNodeById(nodeId);
            if (!node) return;
            const tooltip = li.querySelector(".tooltip");
            if (tooltip) tooltip.innerHTML = renderTooltip(node);
        }});
    }});
    </script>
    '''