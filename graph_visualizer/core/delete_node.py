from typing import Any, Dict
from graph_visualizer.api.model.graph import Graph
from api.model.node import Node


def delete_node(g: Graph, node_id: str) -> Graph:
    node_to_delete = g.get_node_by_id(node_id)

    if not node_to_delete:
        raise ValueError(f"Node with id '{node_id}' not found.")
    
    g.remove_node(node_to_delete)
    
    return g