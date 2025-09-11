from typing import Any, Dict
from graph_visualizer.api.model.graph import Graph
from api.model.node import Node
from api.model.edge import Edge

def create_edge(g: Graph, from_id: str, to_id: str, edge_type: str = 'related') -> Graph:
    from_node = g.get_node_by_id(from_id)
    to_node = g.get_node_by_id(to_id)
    if not from_node:
        raise ValueError(f"Source node with ID '{from_id}' not found.")
    if not to_node:
        raise ValueError(f"Target node with ID '{to_id}' not found.")
    new_edge = Edge(directed=g.directed, from_node=from_node, to_node=to_node, edge_type=edge_type)
    g.add_edge(new_edge)
    return g