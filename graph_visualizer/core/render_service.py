from typing import Optional
from api.model.graph import Graph
from .plugin_registry import get_visualizer

def render_graph_html(graph: Graph, visualizer_key: str = "simple", width: int = 980, height: int = 620, context: Optional[dict] = None) -> str:
    plugin = get_visualizer(visualizer_key)
    return plugin.render(graph, width=width, height=height, context=context or {})
